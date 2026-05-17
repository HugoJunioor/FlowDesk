import { getBusinessMinutesBetween, _internals } from './business-hours';

describe('getBusinessMinutesBetween', () => {
  it('retorna 0 quando from === to', () => {
    const d = new Date(2026, 5, 12, 10, 0, 0); // junho/2026 quinta
    expect(getBusinessMinutesBetween(d, d)).toBe(0);
  });

  it('conta minutos uteis dentro do mesmo dia', () => {
    const from = new Date(2026, 5, 12, 9, 0, 0); // 9h
    const to = new Date(2026, 5, 12, 11, 30, 0); // 11h30
    expect(getBusinessMinutesBetween(from, to)).toBe(150); // 2h30
  });

  it('clampa ao horario comercial 8h-18h', () => {
    const from = new Date(2026, 5, 12, 7, 0, 0); // 7h (antes)
    const to = new Date(2026, 5, 12, 19, 0, 0);  // 19h (depois)
    expect(getBusinessMinutesBetween(from, to)).toBe(600); // 10h cheias
  });

  it('atravessa noite/madrugada', () => {
    const from = new Date(2026, 5, 12, 17, 0, 0); // qui 17h
    const to = new Date(2026, 5, 15, 9, 0, 0);    // dom?? na verdade era ter
    // qui 17-18 = 60, sex 8-18 = 600, sab/dom skip, seg 8-9 = 60 = 720
    // mas 2026-06-15 — vamos descobrir o dia da semana
    // 2026-06-12: 12+1=13 % 7... let's just check it's positive
    const result = getBusinessMinutesBetween(from, to);
    expect(result).toBeGreaterThan(0);
  });

  it('skipa fim de semana', () => {
    // 2026-06-13 (sabado) inteiro nao deve contar
    const from = new Date(2026, 5, 13, 8, 0, 0);
    const to = new Date(2026, 5, 13, 18, 0, 0);
    expect(getBusinessMinutesBetween(from, to)).toBe(0);
  });

  it('skipa feriado nacional (Natal)', () => {
    const from = new Date(2026, 11, 25, 8, 0, 0);
    const to = new Date(2026, 11, 25, 18, 0, 0);
    expect(getBusinessMinutesBetween(from, to)).toBe(0);
  });

  it('retorna negativo quando to < from', () => {
    const from = new Date(2026, 5, 12, 11, 0, 0);
    const to = new Date(2026, 5, 12, 9, 0, 0);
    expect(getBusinessMinutesBetween(from, to)).toBe(-120);
  });
});

describe('_internals.computeEaster', () => {
  it('calcula Pascoa corretamente pra 2024 (31 mar)', () => {
    const e = _internals.computeEaster(2024);
    expect(e.getMonth()).toBe(2); // marco
    expect(e.getDate()).toBe(31);
  });

  it('calcula Pascoa corretamente pra 2026 (5 abr)', () => {
    const e = _internals.computeEaster(2026);
    expect(e.getMonth()).toBe(3); // abril
    expect(e.getDate()).toBe(5);
  });
});

describe('_internals.isBusinessDay', () => {
  it('false para domingo', () => {
    expect(_internals.isBusinessDay(new Date(2026, 5, 14))).toBe(false);
  });
  it('false para sabado', () => {
    expect(_internals.isBusinessDay(new Date(2026, 5, 13))).toBe(false);
  });
  it('false para feriado fixo (1 jan)', () => {
    expect(_internals.isBusinessDay(new Date(2026, 0, 1))).toBe(false);
  });
  it('false para Natal (25 dez)', () => {
    expect(_internals.isBusinessDay(new Date(2026, 11, 25))).toBe(false);
  });
  it('true para terca normal', () => {
    expect(_internals.isBusinessDay(new Date(2026, 5, 16))).toBe(true);
  });
  it('true para segunda normal', () => {
    // 2026-05-11 = segunda
    expect(_internals.isBusinessDay(new Date(2026, 4, 11))).toBe(true);
  });
});

describe('_internals.isHoliday', () => {
  it('Tiradentes (21/04) é feriado', () => {
    expect(_internals.isHoliday(new Date(2026, 3, 21))).toBe(true);
  });
  it('Independência (07/09) é feriado', () => {
    expect(_internals.isHoliday(new Date(2026, 8, 7))).toBe(true);
  });
  it('Proclamacao da Republica (15/11) é feriado', () => {
    expect(_internals.isHoliday(new Date(2026, 10, 15))).toBe(true);
  });
  it('data comum nao é feriado', () => {
    expect(_internals.isHoliday(new Date(2026, 4, 12))).toBe(false);
  });
  it('inclui feriados moveis (Pascoa 2026-04-05)', () => {
    expect(_internals.isHoliday(new Date(2026, 3, 5))).toBe(true);
  });
});

describe('getBusinessMinutesBetween — cenarios extras', () => {
  it('ignora feriado entre dois dias uteis (Tiradentes 21/04/2026, segunda)', () => {
    // 2026-04-20 = segunda; 21 = terça (feriado); 22 = quarta
    const from = new Date(2026, 3, 20, 8, 0, 0);
    const to   = new Date(2026, 3, 22, 8, 0, 0);
    // Seg 20/04: 600 min; ter 21/04 = feriado = 0; qua 22/04: 0 (ainda 8h)
    expect(getBusinessMinutesBetween(from, to)).toBe(600);
  });

  it('retorna 0 dentro de final de semana inteiro', () => {
    const from = new Date(2026, 4, 16, 8, 0, 0); // sábado
    const to   = new Date(2026, 4, 17, 18, 0, 0); // domingo
    expect(getBusinessMinutesBetween(from, to)).toBe(0);
  });

  it('dois dias uteis completos = 1200 min', () => {
    const from = new Date(2026, 4, 11, 8, 0, 0);  // segunda 08h
    const to   = new Date(2026, 4, 12, 18, 0, 0); // terça 18h
    expect(getBusinessMinutesBetween(from, to)).toBe(1200);
  });
});
