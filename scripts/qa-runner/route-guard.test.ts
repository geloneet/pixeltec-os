import { describe, expect, it } from "vitest";
import { describeBlockedWebSocket, WEBSOCKET_BLOCK_REASON } from "./route-guard";

describe("describeBlockedWebSocket — política de bloqueo total de WebSockets (req. 14)", () => {
  it("reporta cualquier URL de WebSocket como bloqueada, sin excepción de host/origin", () => {
    expect(describeBlockedWebSocket("ws://127.0.0.1:1/")).toEqual({
      url: "ws://127.0.0.1:1/",
      resourceType: "websocket",
      reason: WEBSOCKET_BLOCK_REASON,
    });
  });

  it("un WebSocket seguro (wss://) al MISMO origin permitido también se bloquea — hoy no hay excepción alguna", () => {
    expect(describeBlockedWebSocket("wss://app:3000/ws")).toEqual({
      url: "wss://app:3000/ws",
      resourceType: "websocket",
      reason: WEBSOCKET_BLOCK_REASON,
    });
  });

  it("preserva la URL tal cual la reporta Playwright (WebSocketRoute.url()), sin normalizar", () => {
    const url = "ws://evil.example.com:9999/socket?x=1";
    expect(describeBlockedWebSocket(url).url).toBe(url);
  });
});
