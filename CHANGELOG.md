# Changelog · Valora

Histórico de cambios estructurales. Cada bloque del refactor del 2026-Q2 cierra con un commit independiente para que la versión productiva en GitHub quede estable después de cada gate.

---

## [Bloque 1] · Fixes críticos que cambian el veredicto · 2026

Cierra cinco bugs identificados en la auditoría profesional 2026-Q2. Cada fix preserva intacto lo que ya estaba bien (extracción de datos AV, Piotroski, fórmulas de ratios, matriz sensibilidad, DCF inverso conceptual, margen Graham/Buffett, estructura visual del informe, flujo SABI .xlsx).

### Pre · Caché de respuestas Alpha Vantage en sessionStorage

**Qué se cambió.** `avFetch(fn, ticker)` ahora consulta `sessionStorage['av:<FN>:<TICKER>:<KEYHASH>']` antes de hacer el request real. Si hay hit, devuelve la respuesta cacheada (0 reqs de API). Si no, hace el request y cachea el resultado válido. `avHasCache(fn, ticker)` permite saltar el `avSleep(1200)` cuando la siguiente llamada va a cache. TTL = vida de la pestaña.

**Por qué.** El plan free de Alpha Vantage solo da 25 requests/día (~6 análisis distintos). Sin caché, reanalizar el mismo ticker durante validación o iteración consume requests innecesarios. Crítico para que la matriz de validación multi-ticker no agote el cupo.

**Impacto.** Reanalizar AAPL en la misma sesión: 0 requests. Cambiar a otro ticker: 4 requests (siempre). Refresh F5: 4 requests (sessionStorage se preserva entre F5 pero no entre cierre de pestaña).

---

### Fix 1.2 · Consistencia de divisa (`currencySymbol()`, refactor `fmtEUR`/`fmtMilEUR`)

**Qué se cambió.**
- Nuevo helper `currencySymbol()` que lee `unitInfo.currency` y devuelve `€`/`$`/`£`/`¥`/`CHF`/`C$`/etc.
- `fmtEUR(v)` y `fmtMilEUR(v)` (nombres legacy preservados por compatibilidad con ~60 callsites) ahora usan `currencySymbol()` en runtime, en lugar de hardcodear `€`.
- HTML del input de "Deuda neta manual (M €)" cambiado a "(M `<span id='lbl-debt-ccy'>€</span>`)" — `renderCompanyCard()` actualiza el span con `currencySymbol()` al cargar empresa.
- Header "Precio (€)" del comparador de peers cambiado a "Precio (moneda nativa)".
- Watchlist muestra el precio con el símbolo de moneda del análisis guardado (lee `item.unitInfo.currency`).
- `buildDatasetFromAV` y `buildDatasetFromFMP` ya seteaban `unitInfo.currency` correctamente; nada cambia en el flujo de datos.

**Por qué.** El informe mostraba datos USD pero etiquetados con `€` para tickers como AAPL/NESN.SW. Cambia el veredicto: 250 € intrínseco vs 220 USD no es comparable.

**Impacto en los tickers.**
- AAPL → todo en USD ($).
- ITX.MC → todo en EUR (€).
- NESN.SW → todo en CHF.
- JPM → todo en USD ($).
- SABI .xlsx español → todo en EUR (sin cambio).

---

### Fix 1.3 · Free Cash Flow correcto (OCF − CapEx) con fallback explícito

**Qué se cambió.**
- Nueva función `computeFCF(d)` que devuelve `{ value, method, label, ocf, capex }`.
  - `method='real'` si hay `d.ocf` y `d.capex` del cash flow statement → `value = ocf − |capex|`.
  - `method='approx'` si no → `value = bn + amortizaciones` (fallback explícito).
- Schema interno (`extractedData[year]`) ampliado: ahora incluye `ocf`, `capex`, `dividendsPaid`, `buybacks` (de AV y FMP). SABI no tiene cashflow statement detallado → cae siempre a `approx`.
- 7 callsites migrados a `computeFCF(d).value`:
  - `computePiotroski` test 2 (CFO positivo) y test 4 (quality of earnings) — el test 4 ahora es útil de verdad (con la aproximación BN+amort siempre superaba a BN, era trivial).
  - `detectRedFlags` regla 5 (Calidad de beneficios baja) — antes solo se disparaba en SABI, ahora también con AV/FMP cuando OCF<BN×0.7.
  - `renderRobustness` (cf0 base del DCF y reverse DCF).
  - `renderCrecimiento` (CAGR del cash flow).
  - `renderCapital` (chart del CF económico).
  - `renderValuation` (cf0 para la tabla DCF).
- Badge en UI: la card DCF muestra "FCF real" (verde) o "FCF aprox." (ámbar), y el label completo del método.
- Disclaimer NIIF 16 solo se muestra cuando `method='approx'` (con FCF real el CapEx ya está internalizado).

**Por qué.** `BN + amortizaciones` sobreestima el FCF en empresas con CapEx alto. Para AAPL FY24: BN+amort ≈ 105B, mientras FCF real (OCF − CapEx) = 118.3 − 9.4 ≈ 109B. La diferencia es modesta para Apple porque su CapEx es bajo; en empresas con CapEx intensivo (utilities, telcos, manufacturas) la sobreestimación puede ser del 30-50%.

**Impacto en los tickers.**
- AAPL → FCF real ≈ 108B USD. DCF más realista. Badge "FCF real".
- ITX.MC → CapEx 1.6B vs OCF 9.0B → FCF ≈ 7.4B EUR. Badge "FCF real".
- JPM → financiera, CapEx irrelevante. OCF = FCF directamente. Badge "FCF real".
- SABI → siempre badge "FCF aprox." con disclaimer NIIF 16 si aplica.

---

### Fix 1.4 · Deuda neta con marketable securities

**Qué se cambió.**
- `computeNetDebt(d, userOverride)` reescrita:
  - Si el schema tiene `cash_only`, `short_term_inv`, `long_term_inv` (AV/FMP) → método `expanded`: `netDebt = deudasFin − cash − shortTermInv − longTermInv`.
  - Si el sector es `Financial Services` o `Real Estate` → `longTermInv` se omite del cálculo (son activos operativos del negocio, no excedente).
  - Si no hay marketables (SABI) → fallback a método `narrow` legacy (`deudasFin − tesorería`).
  - User override siempre prevalece sobre ambos.
- Devuelve un `breakdown` con todas las líneas para visualización.
- `renderRobustness` muestra un `<details>` colapsable "Desglose de deuda neta" cuando `method='expanded'`. Click para abrir → ve la suma línea a línea. Cerrado por defecto para no añadir ruido visual.

**Por qué.** AAPL tiene ~91B en `longTermInvestments` (corporate bonds, Treasury bills) que son cuasi-cash. El cálculo `deudasFin − tesorería` lo ignora y reporta deuda neta de +30B cuando la realidad es caja neta negativa de -50B. Impacto directo en EV: 80B de diferencia → el valor por acción cambia ~5 USD.

**Impacto en los tickers.**
- AAPL → deuda neta entre -50B y -30B USD (caja neta). Badge "caja neta" en el desglose.
- ITX.MC → caja neta clara (Inditex tiene ~10B en tesorería + inversiones, deuda mínima).
- NESN.SW → deuda neta positiva moderada.
- JPM → `longTermInvestments` NO se descuenta (cartera de préstamos). Solo descuenta cash + short-term.
- SABI → método `narrow` legacy con aviso NIIF 16 si aplica (sin cambio).

---

### Fix 1.1 · Múltiplos sectoriales dinámicos (`SECTOR_MULTIPLES`)

**Qué se cambió.**
- Nueva constante `SECTOR_MULTIPLES` con valores por sector GICS (mediana global 2026): Technology 28×/16×, Communications 22×/13×, Consumer Cyclical 18×/11×, Consumer Defensive 19×/12×, Healthcare 22×/14×, Financials 12×/NULL/P/B=1.3×, Industrials 17×/10×, Energy 12×/6×, Materials 14×/8×, Real Estate 18×/16×/P/B=1.5×, Utilities 14×/11×, `_default` 16×/10×.
- Nueva constante `EV_SALES_MULTIPLES` (anticipo del fix 2.7).
- Funciones `getSectorMultiples(sector)` y `getEVSalesMultiple(sector)` con fallback `_default`.
- Nueva función `applySectorAutoFill()` que se llama desde `buildDatasetFromAV` y `buildDatasetFromFMP`: rellena los inputs PER y EV/EBITDA con los del sector detectado **solo si el usuario no ha sobrescrito** (data-source !== 'manual').
- Inputs HTML PER y EV/EBITDA con `data-source` (default → auto → manual) y `data-sector-label` para mostrar la fuente en UI.
- Hints dinámicos: `hint-per` y `hint-ev-ebitda` muestran "Auto: Tech (mediana global)" o "Override manual activo".
- `renderValuation` añade badge "AUTO · Tech (mediana global)" o "OVERRIDE MANUAL" junto al título de cada card.
- Para financieras (`evEbitda: null` en la tabla) → badge "NO APLICABLE · Financials (usar P/B)" y el input queda en data-source='omitted'.

**Por qué.** PER 15× y EV/EBITDA 9× hardcoded eran valores razonables para retail/industrial europeo (matched legado SABI académico). Para AAPL con PER objetivo 15× la valoración era artificialmente baja (~140 USD/acción frente a 220 USD reales del mercado). Para JPM, el EV/EBITDA no era ni siquiera interpretable.

**Coexistencia con SECTOR_BENCHMARKS Damodaran (§ I·08).** Mantenemos ambas tablas porque tienen propósitos distintos:
- `SECTOR_MULTIPLES` (nueva): alimenta los inputs § I·00 (cálculo de PER/EV-EBITDA/PB objetivos). Mediana global GICS.
- `SECTOR_BENCHMARKS` (existente, 34 entradas Damodaran): alimenta la comparativa § I·08 con mediana sectorial Damodaran EU. Granularidad mucho mayor (retail_apparel, telecom_wireless…).

Los valores difieren legítimamente entre las dos tablas (mediana global vs EU). No las armonizamos automáticamente; cada una refleja su universo.

**Impacto en los tickers.**
- AAPL → PER 28×, EV/EBITDA 16×, badge "AUTO · Tech".
- ITX.MC → PER 18×, EV/EBITDA 11×, badge "AUTO · Consumer Cyclical".
- NESN.SW → PER 19×, EV/EBITDA 12×, badge "AUTO · Consumer Staples".
- JPM → PER 12×, EV/EBITDA omitido con badge "NO APLICABLE · Financials".
- NEE → PER 14×, EV/EBITDA 11×, badge "AUTO · Utilities".
- RIVN → PER 18×, EV/EBITDA 11× (Consumer Cyclical). Ambos se mostrarán como "no aplicable" desde Fix 1.5 si pérdidas / EBITDA<0.
- SABI sin sector FMP → SECTOR_MULTIPLES no se aplica; mantiene valores manuales actuales (15×/9×).

---

### Fix 1.5 · Salvaguardas universales + NEUTRO CONTEXTUAL + panel colapsable

**Qué se cambió.**
- Nueva función `computeBusinessProfile(years)` que devuelve un objeto con:
  - Banderas de sector: `isFinancial`, `isREIT`, `isUtility`, `isCapitalLight`.
  - Banderas de estado: `isLossMaking`, `hasNegativeFCF`, `isHyperGrowth`, `isInDistress`.
  - Banderas co-confirmadas (las que requieren múltiples señales):
    - `hasLegitimateNegativeWC` = FM<0 **y** rotación stocks > 24 (= <15 días) **y** FCF margin mínimo 5y > 5% **y** Piotroski ≥ 6 **y** stddev liquidez 5y < 0.20.
    - `hasStrategicDebt` = cobertura intereses > 8× **y** FCF margin > 10% **y** capacidad devolución > 1 **y** Piotroski ≥ 6.
  - Métricas auxiliares (`fcfMargin`, `interestCoverageRatio`, `cagrVentas5y`, etc.) para diagnóstico.
- Nueva función `contextualizeVerdict(rawVerdict, kind, profile)` que aplica salvaguardas:
  - En distress (`isInDistress`): NUNCA suprime. Mantiene severidad original.
  - Liquidez/acid_test/tesorería + `hasLegitimateNegativeWC` → degrada a `neutral`.
  - Endeudamiento/apalancamiento/calidad_deuda/exigible_patrim/cap_devol_prest/rec_propios_lp + sector financiero → `neutral` con mensaje sobre CET1/Tier 1.
  - Idem + sector utility → `neutral` con mensaje sobre estructura regulada.
  - Idem + `hasStrategicDebt` → `neutral` con mensaje sobre uso estratégico de deuda.
  - Solvencia + financial → `neutral` ("no aplicable").
  - Solvencia + `hasStrategicDebt` → `neutral` ("compensada por FCF sólido").
  - El rawVerdict original SIEMPRE se conserva en `.raw` para el panel colapsable.
- Nueva clase visual `--neutral` (`#475569` Slate-600) y `--neutral-bg` (`#F8FAFC` Slate-50). Badge `.verdict.neutral` con borde discontinuo.
- `verdictLabel(status)` añade caso "Neutro contextual".
- `row()` helper sin cambios estructurales; soporta el nuevo estado.
- `renderFinRatios` aplica `contextualizeVerdict` a 11 ratios financieros y construye un `<details>` colapsable "Ver evaluación sin contexto sectorial" con los ratios afectados en su versión bruta.
- `renderQuality` muestra al inicio:
  - Caja roja con warning de distress si `isInDistress` (las alertas NO se contextualizan).
  - Caja gris con el contexto del perfil si hay salvaguardas activas (working capital negativo legítimo, apalancamiento estratégico, utilities, financieras).
- `renderSummary` (resumen ejecutivo § 00) contextualiza los 19 verdicts y añade tile "Neutro ctx." cuando hay ratios desactivados por contexto.
- `currentBusinessProfile` global, reseteado a `null` en cada carga (processFile, AV, FMP, watchlist restore, setCurrentBlock) y recalculado en `renderInvestment` y como fallback en `renderAnalysis`.

**Por qué.** Las alertas de "peligro concursal" (liquidez < 1) se disparaban indiscriminadamente en empresas como Inditex (working capital negativo es legítimo: stocks rotan en <15 días, proveedores financian a la empresa) o Apple (mismo perfil + buybacks agresivos). Las alertas de "descapitalización" lo hacían en utilities (deuda estructural por activos regulados) y en empresas con uso estratégico de deuda barata. Pero suprimir alertas a la ligera puede enmascarar empresas en distress real → la co-confirmación con múltiples señales protege contra falsos positivos en ambos sentidos. El panel colapsable mantiene visible la evaluación bruta para auditoría.

**Impacto en los tickers.**
- AAPL → `hasStrategicDebt` = true. Ratios de endeudamiento aparecen como **Neutro contextual** con mensaje sobre uso estratégico de deuda. Panel "Ver evaluación sin contexto sectorial" disponible al pie.
- ITX.MC → `hasLegitimateNegativeWC` = true. Ratios de liquidez aparecen como **Neutro contextual** con mensaje sobre WC negativo legítimo. Endeudamiento NO contextualizado (Inditex tiene caja neta, no aplica `hasStrategicDebt`).
- NESN.SW → NO encaja en WC negativo agresivo ni en strategic debt (deuda moderada, rotación normal). Alertas se mantienen en su severidad original. Esperado.
- JPM → `isFinancial` = true. Endeudamiento + solvencia aparecen como **Neutro contextual** con mensaje "se evalúa con CET1/Tier 1".
- NEE → `isUtility` = true. Endeudamiento aparece como **Neutro contextual** con mensaje sobre estructura regulada.
- RIVN → `isInDistress` = true (Piotroski bajo, Altman bajo). Warning rojo al inicio. NINGUNA alerta se contextualiza.

---

## Limitaciones conocidas tras Bloque 1

Detectadas durante la implementación. No son blockers para producción pero conviene documentarlas para futuras iteraciones:

1. **Validación empírica pendiente.** El refactor pasó `node --check` y un audit de callsites, pero la validación en producción con AAPL/ITX.MC/JPM la harás tú con tu API key real. Si el comportamiento difiere de lo descrito arriba, escala y ajustamos antes del Bloque 2.

2. **`hasStrategicDebt` con AAPL puede no disparar si la cobertura de intereses calculada es absurda.** AAPL reporta `gastos_fin` ≈ 0 en algunos años (más ingresos por intereses que gastos). El ratio `interestCoverageRatio = BAII / gastos_fin` puede dar `Infinity` o `0` según la dirección del neto. Con `gastos_fin=0`, mi código pone `interestCoverageRatio = null` y `hasStrategicDebt` queda en `false`. Para Apple, esto resulta en que las alertas de endeudamiento NO se degradan automáticamente. **Mitigación futura**: caso especial cuando gastos_fin ≤ 0 (la empresa cobra netamente intereses) → `interestCoverageRatio = Infinity` aceptable y `hasStrategicDebt` puede activarse por las otras 3 condiciones (FCF margin > 10%, cap_devol > 1, Piotroski ≥ 6).

3. **Rotación de stocks en empresas sin inventario significativo.** Para tech / SaaS / financieras, `existencias` puede ser 0 o trivial → `rotacionStocks = consumo / existencias` da números absurdos (millones). El umbral > 24 los activa todos espurriamente. Mitigación: solo aplicar la condición `rotacionStocks > 24` cuando `existencias > 1% del activo total`. Pendiente de fix menor.

4. **Sufijos de tickers internacionales en Alpha Vantage.** Alpha Vantage usa sufijos distintos a Yahoo: `.LON` (no `.L`), `.PAR` (no `.PA`), `.FRK` (no `.DE`), `.MAD` (no `.MC`), `.MIL` (no `.MI`), `.SWX` (no `.SW`). El UI ya lo documenta en el bloque "Sufijos Alpha Vantage" tras el input ticker. **Limitación real**: algunos tickers internacionales del plan free de AV no devuelven `annualReports` para BALANCE_SHEET/INCOME_STATEMENT (cobertura limitada). En esos casos verás `NO_FINANCIAL_DATA` real, no un rate-limit silencioso.

5. **Caché AV en sessionStorage vs persistente.** La caché actual se borra al cerrar pestaña. Caché persistente (localStorage o IndexedDB con TTL 24h) sería mejor para evitar agotar los 25 req/día entre sesiones. Lo dejamos como mejora del bloque 3 (no es bloqueante).

6. **Validación de balance Activo ≈ Pasivo + PN.** Pendiente del Bloque 3 (fix 3.1 degradación elegante). Si AV devuelve totales inconsistentes, ahora mismo el flujo no lo detecta antes del análisis.

7. **`computeFCF` siempre asume CapEx positivo.** Si AV devuelve `capex` con signo (algunos endpoints lo dan negativo), `Math.abs()` lo absorbe; pero si devuelve un valor inflado por adquisiciones (acquisitionsNet incluido), el FCF puede quedar subestimado. Trazabilidad clara con el badge "FCF real" / "FCF aprox.".

---

## [Bloque 2] · Mejoras de precisión

Pendiente. Cubrirá: ROIC + buyback disclaimer, DCF multifase 5+5+perpetuidad, WACC dinámico CAPM, Yields (FCF/Earnings/Shareholder), detección deudores anómalos, bug DCF inverso, EV/Sales como método principal en pérdidas.

## [Bloque 3] · Pulido y robustez

Pendiente. Cubrirá: validación de datos + degradación elegante, disclaimer Z' vs Z público, confidence bands P10/P50/P90, veredicto adaptado al perfil.
