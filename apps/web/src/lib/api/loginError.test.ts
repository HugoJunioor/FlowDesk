/**
 * A regressão que estes testes travam: uma falha de infraestrutura sendo
 * anunciada como senha errada.
 *
 * Isso custou caro em produção — o login estourava o timeout de 30s do axios,
 * o usuário lia "Usuário ou senha inválidos", tentava de novo, e cada tentativa
 * consumia o lockout de 5/15min do backend. A investigação começou pela senha
 * porque era o que a tela dizia.
 */
import { describe, expect, it } from "vitest";
import { AxiosError, AxiosHeaders } from "axios";
import { ApiError, toApiError } from "./client";
import { CREDENCIAL_INVALIDA, describeLoginFailure } from "./loginError";

function axiosErrorWithResponse(status: number, mensagem?: string): AxiosError {
  const err = new AxiosError("Request failed", "ERR_BAD_REQUEST");
  err.response = {
    status,
    statusText: "",
    data: mensagem ? { erro: true, mensagem } : {},
    headers: {},
    config: { headers: new AxiosHeaders() },
  } as AxiosError["response"];
  return err;
}

function axiosErrorNoResponse(code: string): AxiosError {
  return new AxiosError(`falha ${code}`, code);
}

describe("toApiError — classifica a falha", () => {
  it("timeout do axios vira kind=timeout, não status 401", () => {
    const e = toApiError(axiosErrorNoResponse("ECONNABORTED"));
    expect(e.kind).toBe("timeout");
    expect(e.status).toBe(0);
    expect(e.isInfraFailure).toBe(true);
  });

  it("erro de rede vira kind=network", () => {
    const e = toApiError(axiosErrorNoResponse("ERR_NETWORK"));
    expect(e.kind).toBe("network");
    expect(e.isInfraFailure).toBe(true);
  });

  it("resposta do servidor vira kind=http", () => {
    const e = toApiError(axiosErrorWithResponse(401));
    expect(e.kind).toBe("http");
    expect(e.status).toBe(401);
    expect(e.isInfraFailure).toBe(false);
  });

  it("5xx é falha de infraestrutura mesmo tendo resposta", () => {
    expect(toApiError(axiosErrorWithResponse(502)).isInfraFailure).toBe(true);
  });
});

describe("describeLoginFailure", () => {
  it("401 é a única coisa que afirma credencial inválida", () => {
    expect(describeLoginFailure(toApiError(axiosErrorWithResponse(401)))).toBe(
      CREDENCIAL_INVALIDA,
    );
  });

  it.each([
    ["timeout", toApiError(axiosErrorNoResponse("ECONNABORTED"))],
    ["rede", toApiError(axiosErrorNoResponse("ERR_NETWORK"))],
    ["500", toApiError(axiosErrorWithResponse(500))],
    ["502", toApiError(axiosErrorWithResponse(502))],
    ["504", toApiError(axiosErrorWithResponse(504))],
  ])("%s NÃO diz que a credencial está errada", (_nome, err) => {
    expect(describeLoginFailure(err)).not.toBe(CREDENCIAL_INVALIDA);
    expect(describeLoginFailure(err).toLowerCase()).not.toContain("senha inválidos");
  });

  it("timeout diz explicitamente que a senha não foi recusada", () => {
    const msg = describeLoginFailure(toApiError(axiosErrorNoResponse("ECONNABORTED")));
    expect(msg).toContain("não foi recusada");
  });

  it("429 mantém a orientação de aguardar", () => {
    expect(describeLoginFailure(toApiError(axiosErrorWithResponse(429)))).toContain(
      "Muitas tentativas",
    );
  });

  it("403 repassa a mensagem do backend (lockout traz o tempo restante)", () => {
    const err = toApiError(
      axiosErrorWithResponse(403, "Muitas tentativas falhas. Tente novamente em 15 minutos."),
    );
    expect(describeLoginFailure(err)).toContain("15 minutos");
  });

  it("403 sem mensagem cai no texto de conta bloqueada", () => {
    const err = new ApiError("", 403, undefined, undefined, "http");
    expect(describeLoginFailure(err)).toContain("Conta bloqueada");
  });

  it("status inesperado não afirma credencial inválida", () => {
    const err = new ApiError("Gateway estranho", 418, undefined, undefined, "http");
    expect(describeLoginFailure(err)).not.toBe(CREDENCIAL_INVALIDA);
  });

  it("não distingue usuário inexistente de senha errada — ambos 401, mesma frase", () => {
    const semUsuario = toApiError(axiosErrorWithResponse(401, "Usuário ou senha inválidos"));
    const senhaErrada = toApiError(axiosErrorWithResponse(401, "Usuário ou senha inválidos"));
    expect(describeLoginFailure(semUsuario)).toBe(describeLoginFailure(senhaErrada));
  });
});
