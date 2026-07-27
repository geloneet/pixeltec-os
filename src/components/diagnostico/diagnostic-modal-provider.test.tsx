/**
 * @vitest-environment jsdom
 *
 * El `vitest.config.ts` del proyecto declara `environment: "node"`, así que un
 * test de componente debe declarar el suyo. Sin este docblock el archivo
 * fallaría por ausencia de DOM, no por el comportamiento bajo prueba — que es
 * exactamente lo que le ocurre a los 15 tests de componente ya existentes.
 *
 * Se usa `fireEvent` y no `@testing-library/user-event`: ese paquete no es una
 * dependencia del proyecto y añadirlo excede el alcance de esta corrección.
 * Los disparadores se enfocan explícitamente antes de activarlos, que además
 * es el recorrido de teclado — el que de verdad necesita el retorno de foco.
 */
import { useState } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { DiagnosticModalProvider, useDiagnosticModal } from './diagnostic-modal-provider';

/**
 * Regresión que cubre: el modal se abre por contexto y no por `DialogTrigger`,
 * así que Radix no conoce el elemento de origen y el foco terminaba en el
 * documento al cerrar. Aquí se fija que vuelve siempre al disparador correcto.
 */

// El wizard real arrastra server actions y estado de pasos; nada de eso
// participa en el retorno de foco. Se sustituye por un doble mínimo que expone
// un control de cierre, que es lo único que el contrato necesita.
vi.mock('@/components/diagnostico/DiagnosticWizard', () => ({
  DiagnosticWizard: ({ onClose }: { onClose?: () => void }) => (
    <div>
      <p>wizard</p>
      <button type="button" onClick={onClose}>
        Cerrar wizard
      </button>
    </div>
  ),
}));

function Disparador({ nombre }: { nombre: string }) {
  const diagnostic = useDiagnosticModal();
  return (
    <button type="button" onClick={() => diagnostic?.openDiagnostic()}>
      {nombre}
    </button>
  );
}

/** Disparador que puede desaparecer del DOM mientras el modal sigue abierto. */
function DisparadorEfimero() {
  const diagnostic = useDiagnosticModal();
  const [montado, setMontado] = useState(true);
  return (
    <>
      {montado && (
        <button type="button" onClick={() => diagnostic?.openDiagnostic()}>
          Efímero
        </button>
      )}
      <button type="button" onClick={() => setMontado(false)}>
        Desmontar efímero
      </button>
    </>
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const abierto = () => screen.queryByText('wizard');

/** Activa un disparador tal como lo haría el teclado: primero enfoca, luego activa. */
function activar(boton: HTMLElement) {
  boton.focus();
  fireEvent.click(boton);
}

const pulsarEscape = () => fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });

describe('DiagnosticModalProvider — retorno de foco', () => {
  it('abre desde el trigger del hero y Escape devuelve el foco a ese trigger', async () => {
    render(
      <DiagnosticModalProvider>
        <Disparador nombre="Iniciar diagnóstico" />
      </DiagnosticModalProvider>
    );

    const hero = screen.getByRole('button', { name: 'Iniciar diagnóstico' });
    activar(hero);
    await waitFor(() => expect(abierto()).toBeTruthy());

    pulsarEscape();
    await waitFor(() => expect(abierto()).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(hero));
  });

  it('cierra por acción interna del modal y devuelve el foco al trigger', async () => {
    render(
      <DiagnosticModalProvider>
        <Disparador nombre="Iniciar diagnóstico" />
      </DiagnosticModalProvider>
    );

    const hero = screen.getByRole('button', { name: 'Iniciar diagnóstico' });
    activar(hero);
    await waitFor(() => expect(abierto()).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar wizard' }));
    await waitFor(() => expect(abierto()).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(hero));
  });

  it('con dos disparadores, el foco vuelve al SEGUNDO, no al primero', async () => {
    render(
      <DiagnosticModalProvider>
        <Disparador nombre="Trigger hero" />
        <Disparador nombre="Trigger servicios" />
      </DiagnosticModalProvider>
    );

    const primero = screen.getByRole('button', { name: 'Trigger hero' });
    const segundo = screen.getByRole('button', { name: 'Trigger servicios' });

    // Primera apertura desde el hero, para dejar rastro del disparador anterior.
    activar(primero);
    await waitFor(() => expect(abierto()).toBeTruthy());
    pulsarEscape();
    await waitFor(() => expect(abierto()).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(primero));

    // Segunda apertura desde Servicios: el retorno debe seguir al nuevo origen.
    activar(segundo);
    await waitFor(() => expect(abierto()).toBeTruthy());
    pulsarEscape();
    await waitFor(() => expect(abierto()).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(segundo));
    expect(document.activeElement).not.toBe(primero);
  });

  it('si el disparador se desmonta antes del cierre, no lanza y aplica fallback', async () => {
    const errores = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <DiagnosticModalProvider>
        <DisparadorEfimero />
      </DiagnosticModalProvider>
    );

    // Las referencias se toman ANTES de abrir: con el modal abierto, Radix
    // oculta el fondo a las tecnologías de asistencia y las consultas por rol
    // dejan de encontrarlo — comportamiento correcto del focus trap, no un
    // fallo. Guardar los nodos permite seguir operando sobre ellos.
    const efimero = screen.getByRole('button', { name: 'Efímero' });
    const desmontar = screen.getByRole('button', { name: 'Desmontar efímero' });

    activar(efimero);
    await waitFor(() => expect(abierto()).toBeTruthy());

    // Se retira el disparador mientras el modal sigue abierto.
    fireEvent.click(desmontar);
    await waitFor(() => expect(efimero.isConnected).toBe(false));

    pulsarEscape();
    await waitFor(() => expect(abierto()).toBeNull());

    // El contrato es que no reviente y que el foco quede en un nodo vivo del
    // documento, nunca en uno separado.
    expect(document.activeElement).toBeTruthy();
    expect(document.activeElement?.isConnected).toBe(true);
    expect(errores).not.toHaveBeenCalled();
  });

  it('mantiene una sola instancia del wizard tras varias aperturas', async () => {
    render(
      <DiagnosticModalProvider>
        <Disparador nombre="Trigger hero" />
        <Disparador nombre="Trigger servicios" />
      </DiagnosticModalProvider>
    );

    for (const nombre of ['Trigger hero', 'Trigger servicios', 'Trigger hero']) {
      activar(screen.getByRole('button', { name: nombre }));
      await waitFor(() => expect(screen.getAllByText('wizard')).toHaveLength(1));
      pulsarEscape();
      await waitFor(() => expect(abierto()).toBeNull());
    }
  });

  it('al abrir, el foco entra en el modal (focus trap intacto)', async () => {
    render(
      <DiagnosticModalProvider>
        <Disparador nombre="Iniciar diagnóstico" />
      </DiagnosticModalProvider>
    );

    activar(screen.getByRole('button', { name: 'Iniciar diagnóstico' }));
    await waitFor(() => expect(abierto()).toBeTruthy());

    const dialogo = screen.getByRole('dialog');
    await waitFor(() => expect(dialogo.contains(document.activeElement)).toBe(true));
  });
});
