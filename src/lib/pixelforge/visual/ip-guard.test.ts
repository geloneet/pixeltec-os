import { describe, expect, it } from "vitest";
import { isForbiddenAddress } from "./ip-guard";

describe("isForbiddenAddress", () => {
  const casos: Array<[string, boolean, string]> = [
    // Privados IPv4
    ["10.0.0.1", true, "10/8 privado"],
    ["10.255.255.255", true, "10/8 privado, límite superior"],
    ["172.16.0.1", true, "172.16/12 privado, límite inferior"],
    ["172.31.255.255", true, "172.16/12 privado, límite superior"],
    ["172.15.255.255", false, "justo fuera de 172.16.0.0/12"],
    ["172.32.0.0", false, "justo fuera de 172.16.0.0/12 (arriba)"],
    ["192.168.1.1", true, "192.168/16 privado"],
    ["192.168.0.0", true, "192.168/16 privado, red"],
    ["192.169.0.1", false, "justo fuera de 192.168.0.0/16"],
    // Loopback
    ["127.0.0.1", true, "loopback clásico"],
    ["127.255.255.255", true, "loopback, límite superior"],
    // 0.0.0.0/8
    ["0.0.0.0", true, "esta red"],
    ["0.1.2.3", true, "esta red, rango"],
    // link-local / metadata cloud
    ["169.254.169.254", true, "metadata cloud AWS/GCP"],
    ["169.254.0.1", true, "link-local"],
    // CGNAT
    ["100.64.0.1", true, "CGNAT 100.64/10, límite inferior"],
    ["100.127.255.255", true, "CGNAT 100.64/10, límite superior"],
    ["100.63.255.255", false, "justo fuera de 100.64.0.0/10"],
    ["100.128.0.0", false, "justo fuera de 100.64.0.0/10 (arriba)"],
    // Públicas
    ["8.8.8.8", false, "público (Google DNS)"],
    ["1.1.1.1", false, "público (Cloudflare DNS)"],
    ["93.184.216.34", false, "público (example.com histórico)"],
    // IPv6 loopback / ULA / link-local
    ["::1", true, "loopback IPv6"],
    ["fc00::1", true, "ULA fc00::/7"],
    ["fd12:3456:789a::1", true, "ULA fd00::/8 (dentro de fc00::/7)"],
    ["fe80::1", true, "link-local IPv6"],
    // IPv4-mapped
    ["::ffff:127.0.0.1", true, "IPv4-mapped loopback"],
    ["::ffff:169.254.169.254", true, "IPv4-mapped metadata cloud"],
    ["::ffff:8.8.8.8", false, "IPv4-mapped público"],
    // IPv6 público normal
    ["2606:4700:4700::1111", false, "público (Cloudflare DNS IPv6)"],
    // No parseable → fail-closed
    ["no-es-una-ip", true, "entrada no parseable ⇒ fail-closed"],
    ["999.999.999.999", true, "octetos fuera de rango ⇒ fail-closed"],
    ["1.2.3", true, "IPv4 incompleta ⇒ fail-closed"],
  ];

  for (const [ip, expected, desc] of casos) {
    it(`${expected ? "prohíbe" : "permite"} ${ip} (${desc})`, () => {
      expect(isForbiddenAddress(ip)).toBe(expected);
    });
  }
});
