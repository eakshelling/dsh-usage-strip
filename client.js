window.__ModuleLoader__.load({
  id: 'dsh-usage-strip',
  factory(require) {
    const React = require('react')
    const { createPortal } = require('react-dom')
    const h = React.createElement
    const { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } = React

    const NS = 'dsh-usage'
    const ENDPOINT = '/dsh-usage/api.json'
    const POLL_MS = 30_000
    const ENTRY_TTL_MS = 15_000
    const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000

    const zh = {
      today: '今日',
      peak: '峰时',
      valley: '谷时',
      loading: '用量统计中…',
      unavailable: '用量不可用',
      title: '用量与费用',
      close: '关闭',
      rangeToday: '今日',
      range7: '近 7 天',
      range30: '近 30 天',
      rangeAll: '全部',
      kpiCost: '估算费用',
      kpiTokens: 'Tokens',
      kpiRequests: '请求次数',
      kpiCache: '缓存命中率',
      composition: 'Token 构成',
      hit: '缓存命中',
      miss: '未命中输入',
      output: '输出',
      daily: '每日用量',
      dailyCost: '每日费用',
      unitPrice: '有效均价',
      curveCost: '费用',
      curveUnit: '均价',
      curveMax: '最高',
      curveMode: '曲线模式',
      gapNote: '断点表示当日无用量或含未定价模型。',
      gapNoUsage: '无用量',
      gapUnpriced: '部分模型未定价',
      noPriced: '暂无可计价数据',
      models: '按模型',
      model: '模型',
      requests: '请求',
      tokens: '合计',
      cost: '费用',
      share: '占比',
      price: '价格与调价',
      nowPeak: '当前为高峰时段（2 倍价）',
      nowValley: '当前为空闲时段（谷价）',
      nextSwitch: '下次切换',
      valleyPrice: '谷时价',
      peakPrice: '峰时价',
      priceHit: '命中',
      priceMiss: '未命中',
      priceOut: '输出',
      perMillion: '元/百万 tokens',
      priceSource: '价目来源：DeepSeek API 文档',
      changes: '官方调价记录',
      noteEstimate: '费用按费用发生日的官方价目估算，跨调价日会混合新旧价格；这不是官方账单。',
      noteScope: '数据来自本机 DSH 会话日志，按北京时间划日；不含其他客户端或网页端用量。',
      unpriced: '部分模型没有内置价目，其 token 已计入但费用未计入。',
      openPlatform: '打开官方用量页',
      retry: '重试',
      refresh: '刷新',
      error: '读取失败',
      stale: '刷新失败，显示上次成功的数据。',
      partial: '有个别会话读取失败，合计可能偏低。',
      updated: '更新于',
      chartWindow: '图表显示最近 90 天，KPI 与模型合计仍覆盖全部。',
      scopeTitle: '本机所有会话的今日用量与费用；点击查看详情',
      unknownModel: '未知模型',
      noData: '暂无用量数据',
      moreDays: '更早的日期已折叠',
      thisConversation: '本对话',
      allSessions: '全部会话',
      scopeSession: '本对话',
      scopeAll: '全部会话',
      sessionPending: '本对话统计中…',
      sessionUnknown: '本对话暂无记录',
      sessionNote: '本对话同时显示内置 token 的估算费用与日志逐条计算的精确费用。',
      kpiSessionCost: '本对话估算费用',
      kpiSessionTokens: '本对话 Tokens',
      dailySession: '本对话每日用量',
      readyShort: '现成',
      estimatedShort: '估',
      exactShort: '精确',
      readyBlock: '现成读数',
      exactBlock: '日志精确',
      readyEstimate: '估算费用',
      readyBlockNote: '按当前峰谷价和本对话模型占比估算，不追溯历史调价。',
      exactBlockNote: '逐条日志按事件发生时的价目计算。',
      totalApprox: '总价',
      turnSeparator: ' ',
      turnUnit: 'tok',
    }

    const en = {
      today: 'Today',
      peak: 'Peak',
      valley: 'Off-peak',
      loading: 'Measuring usage…',
      unavailable: 'Usage unavailable',
      title: 'Usage and cost',
      close: 'Close',
      rangeToday: 'Today',
      range7: 'Last 7 days',
      range30: 'Last 30 days',
      rangeAll: 'All time',
      kpiCost: 'Estimated cost',
      kpiTokens: 'Tokens',
      kpiRequests: 'Requests',
      kpiCache: 'Cache hit rate',
      composition: 'Token composition',
      hit: 'Cache hit',
      miss: 'Uncached input',
      output: 'Output',
      daily: 'Daily tokens',
      dailyCost: 'Daily cost',
      unitPrice: 'Effective price',
      curveCost: 'Cost',
      curveUnit: 'Avg price',
      curveMax: 'Max',
      curveMode: 'Curve mode',
      gapNote: 'Gaps mean no usage or unpriced models that day.',
      gapNoUsage: 'No usage',
      gapUnpriced: 'Some models unpriced',
      noPriced: 'No priced data yet',
      models: 'By model',
      model: 'Model',
      requests: 'Requests',
      tokens: 'Tokens',
      cost: 'Cost',
      share: 'Share',
      price: 'Prices and changes',
      nowPeak: 'Peak period (2x price)',
      nowValley: 'Off-peak period (valley price)',
      nextSwitch: 'Next switch',
      valleyPrice: 'Off-peak',
      peakPrice: 'Peak',
      priceHit: 'Hit',
      priceMiss: 'Miss',
      priceOut: 'Output',
      perMillion: 'CNY per 1M tokens',
      priceSource: 'Price source: DeepSeek API docs',
      changes: 'Official price changes',
      noteEstimate: 'Cost is estimated from the official price effective on each day, so a total can mix old and new prices. It is not a Platform bill.',
      noteScope: 'Data comes from local DSH session logs, bucketed by Beijing time; other clients and the website are not included.',
      unpriced: 'Some models have no built-in price; their tokens are counted but their cost is not.',
      openPlatform: 'Open the Platform usage page',
      retry: 'Retry',
      refresh: 'Refresh',
      error: 'Read failed',
      stale: 'Refresh failed; showing the last successful data.',
      partial: 'Some sessions could not be read; totals may be low.',
      updated: 'Updated',
      chartWindow: 'The chart shows the last 90 days; KPIs and model totals still cover all time.',
      scopeTitle: 'Today\'s usage and cost across all local sessions; click for details',
      unknownModel: 'Unknown model',
      noData: 'No usage yet',
      moreDays: 'Earlier days are folded',
      thisConversation: 'This chat',
      allSessions: 'All sessions',
      scopeSession: 'This chat',
      scopeAll: 'All sessions',
      sessionPending: 'Measuring this chat…',
      sessionUnknown: 'No record for this chat yet',
      sessionNote: 'This chat shows both a current-price estimate for the built-in token count and an exact per-log cost.',
      kpiSessionCost: 'This chat cost',
      kpiSessionTokens: 'This chat tokens',
      dailySession: 'This chat daily tokens',
      readyShort: 'Built-in',
      estimatedShort: 'est.',
      exactShort: 'Exact',
      readyBlock: 'Built-in reading',
      exactBlock: 'Exact from logs',
      readyEstimate: 'Estimated cost',
      readyBlockNote: 'Estimated with current peak/valley prices and this chat’s model mix; historical prices are not traced.',
      exactBlockNote: 'Each log event is priced at the rate in effect when it occurred.',
      totalApprox: 'Total',
      turnSeparator: ' ',
      turnUnit: 'tok',
    }

    const CSS = `
.dsu-trigger{display:inline-flex;align-items:center;gap:6px;flex:0 1 auto;min-width:0;max-width:100%;padding:1px 8px;border:none;border-radius:var(--dsw-radius-sm);background:transparent;color:var(--dsw-alias-label-tertiary);font-family:inherit;font-size:var(--dsh-content-font-size-secondary,13px);font-variant-numeric:tabular-nums;line-height:calc(20px + var(--dsh-content-font-delta-secondary,0px));white-space:nowrap;cursor:pointer;}
.dsu-reading{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.dsu-trigger[aria-expanded='true']{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary);}
@media (hover:hover){.dsu-trigger:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary);}}
.dsu-dot{width:6px;height:6px;border-radius:50%;flex:none;background:var(--dsw-alias-state-business-primary);}
.dsu-dot[data-peak='true']{background:var(--dsw-alias-state-warn-primary,#d97706);}
.dsu-dot[data-loading='true']{background:var(--dsw-alias-label-tertiary);}
.dsu-peak{color:var(--dsw-alias-label-secondary);}
.dsu-more{color:var(--dsw-alias-label-tertiary);font-size:10px;}
.dsu-spark{display:inline-flex;align-items:flex-end;gap:1px;height:14px;margin-left:2px;}
.dsu-spark-bar{width:3px;border-radius:1px;background:var(--dsw-alias-chart-messages);}
.dsu-panel{position:fixed;z-index:1100;box-sizing:border-box;padding:14px 16px 12px;border:0;border-radius:var(--dsw-radius-lg);background:var(--dsw-specific-menu);backdrop-filter:var(--dsw-menu-backdrop-filter);box-shadow:var(--dsw-elevation-prominent);--dsw-elevation-stroke-color:var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;overflow-x:hidden;overflow-y:auto;cursor:default;--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);}
.dsu-panel:focus{outline:none;}
.dsu-head{display:flex;align-items:center;gap:8px;}
.dsu-title{font-size:14px;font-weight:600;color:var(--dsw-alias-label-primary);}
.dsu-time{margin-left:auto;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;}
.dsu-close,.dsu-icon{flex:none;width:24px;height:24px;padding:0;border:none;border-radius:var(--dsw-radius-sm);background:transparent;color:var(--dsw-alias-label-tertiary);font-size:14px;line-height:24px;cursor:pointer;}
.dsu-close:hover,.dsu-icon:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary);}
.dsu-scopes{display:flex;gap:4px;margin:10px 0 0;}
.dsu-scope{padding:2px 10px;border:none;border-radius:var(--dsw-radius-sm);background:transparent;color:var(--dsw-alias-label-tertiary);font-family:inherit;font-size:12px;line-height:20px;white-space:nowrap;cursor:pointer;}
.dsu-scope:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary);}
.dsu-scope[aria-pressed='true']{background:var(--dsw-alias-state-business-tertiary);color:var(--dsw-alias-state-business-primary);}
.dsu-ranges{display:flex;flex-wrap:wrap;gap:4px;margin:10px 0 12px;}
.dsu-range{padding:2px 10px;border:none;border-radius:var(--dsw-radius-sm);background:transparent;color:var(--dsw-alias-label-tertiary);font-family:inherit;font-size:12px;line-height:20px;white-space:nowrap;cursor:pointer;}
.dsu-range:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary);}
.dsu-range[aria-pressed='true']{background:var(--dsw-alias-state-business-tertiary);color:var(--dsw-alias-state-business-primary);}
.dsu-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;}
@media (max-width:600px){.dsu-kpis{grid-template-columns:repeat(2,minmax(0,1fr));}}
.dsu-kpi{padding:7px 9px;border:0.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-base);}
.dsu-kpi-label{color:var(--dsw-alias-label-tertiary);font-size:11px;}
.dsu-kpi-value{margin-top:2px;color:var(--dsw-alias-label-primary);font-size:16px;font-weight:600;font-variant-numeric:tabular-nums;line-height:22px;}
.dsu-dual{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;}
@media (max-width:560px){.dsu-dual{grid-template-columns:1fr;}}
.dsu-block{min-width:0;padding:9px 10px;border:0.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-base);}
.dsu-block-title{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px;}
.dsu-block-main{margin-top:2px;color:var(--dsw-alias-label-primary);font-size:18px;font-weight:600;font-variant-numeric:tabular-nums;line-height:24px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.dsu-block-unit{color:var(--dsw-alias-label-tertiary);font-size:11px;font-weight:400;}
.dsu-block-sub{margin-top:2px;color:var(--dsw-alias-label-secondary);font-size:11px;font-variant-numeric:tabular-nums;line-height:16px;}
.dsu-block-note{margin-top:4px;color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:14px;}
.dsu-section{margin-top:14px;}
.dsu-section-title{display:flex;align-items:center;gap:8px;margin-bottom:6px;color:var(--dsw-alias-label-tertiary);font-size:11px;letter-spacing:0.02em;}
.dsu-section-title .dsu-rule{flex:1;height:0.5px;background:var(--dsw-alias-border-l1);}
.dsu-compose{display:flex;height:10px;border-radius:999px;overflow:hidden;background:var(--dsw-alias-interactive-bg-hover);}
.dsu-compose-seg{height:100%;min-width:0;}
.dsu-tone-hit{background:var(--dsw-alias-chart-system);}
.dsu-tone-miss{background:var(--dsw-alias-chart-tools);}
.dsu-tone-out{background:var(--dsw-alias-chart-messages);}
.dsu-legend{display:flex;flex-wrap:wrap;gap:12px;margin-top:6px;color:var(--dsw-alias-label-secondary);}
.dsu-legend-item{display:inline-flex;align-items:center;gap:5px;font-variant-numeric:tabular-nums;}
.dsu-swatch{width:8px;height:8px;border-radius:2px;flex:none;}
.dsu-chart{display:flex;flex-direction:column;gap:4px;}
.dsu-bars{display:flex;align-items:flex-end;gap:2px;height:104px;padding-top:4px;}
.dsu-col{position:relative;flex:1 1 0;height:100%;min-width:3px;}
.dsu-stack{position:absolute;left:0;right:0;bottom:0;display:flex;flex-direction:column-reverse;height:100%;}
.dsu-seg{width:100%;}
.dsu-seg-empty{position:absolute;left:0;right:0;bottom:0;height:1px;background:var(--dsw-alias-border-l2);}
.dsu-curve-block{margin-top:8px;}
.dsu-curve-head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:4px 8px;margin-bottom:2px;}
.dsu-curve-caption{min-width:0;color:var(--dsw-alias-label-tertiary);font-size:11px;font-variant-numeric:tabular-nums;}
.dsu-toggle{display:inline-flex;gap:2px;padding:1px;border:0.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-sm);}
.dsu-toggle-btn{min-height:24px;padding:0 8px;border:none;border-radius:var(--dsw-radius-sm);background:transparent;color:var(--dsw-alias-label-tertiary);font-family:inherit;font-size:12px;line-height:22px;cursor:pointer;}
.dsu-toggle-btn[aria-pressed='true']{background:var(--dsw-alias-state-business-tertiary);color:var(--dsw-alias-state-business-primary);}
.dsu-curve{position:relative;height:72px;margin-top:2px;color:var(--dsw-alias-state-business-primary);}
.dsu-curve svg{display:block;width:100%;height:100%;overflow:visible;}
.dsu-curve-area{fill:var(--dsw-alias-state-business-primary);opacity:0.16;}
.dsu-curve-line{fill:none;stroke:var(--dsw-alias-state-business-primary);stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round;}
.dsu-curve-dot{position:absolute;width:6px;height:6px;margin:-3px 0 0 -3px;border-radius:50%;background:var(--dsw-alias-state-business-primary);}
.dsu-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0;}
.dsu-axis{position:relative;height:14px;color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:14px;}
.dsu-axis span{position:absolute;white-space:nowrap;}
.dsu-table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums;}
.dsu-table th{padding:4px 6px;border-bottom:0.5px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-tertiary);font-weight:500;text-align:right;white-space:nowrap;}
.dsu-table td{padding:4px 6px;border-bottom:0.5px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);text-align:right;white-space:nowrap;}
.dsu-table tr:last-child td{border-bottom:none;}
.dsu-table th:first-child,.dsu-table td:first-child{text-align:left;}
.dsu-table .dsu-strong{color:var(--dsw-alias-label-primary);}
.dsu-table-wrap{overflow-x:auto;}
.dsu-price-table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums;}
.dsu-price-table th{padding:3px 6px;color:var(--dsw-alias-label-tertiary);font-weight:500;text-align:right;}
.dsu-price-table td{padding:3px 6px;color:var(--dsw-alias-label-secondary);text-align:right;}
.dsu-price-table th:first-child,.dsu-price-table td:first-child{text-align:left;}
.dsu-price-table .dsu-strong{color:var(--dsw-alias-label-primary);}
.dsu-status{display:flex;align-items:center;gap:6px;margin-bottom:6px;color:var(--dsw-alias-label-secondary);}
.dsu-status .dsu-dot{width:7px;height:7px;}
.dsu-changes{margin:0;padding:0;list-style:none;}
.dsu-change{display:flex;gap:10px;padding:5px 0;border-bottom:0.5px solid var(--dsw-alias-border-l1);}
.dsu-change:last-child{border-bottom:none;}
.dsu-change-date{flex:none;width:78px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;}
.dsu-change-body{min-width:0;}
.dsu-change-title{color:var(--dsw-alias-label-primary);}
.dsu-change-detail{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px;}
.dsu-note{margin-top:8px;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px;}
.dsu-stale{margin:8px 0 0;padding:6px 8px;border:0.5px solid var(--dsw-alias-state-warn-primary,#d97706);border-radius:var(--dsw-radius-sm);color:var(--dsw-alias-state-warn-primary,#d97706);font-size:11px;line-height:16px;}
.dsu-body{min-height:200px;}
.dsu-icon{font-size:13px;}
.dsu-foot{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-top:10px;padding-top:8px;border-top:0.5px solid var(--dsw-alias-border-l1);}
.dsu-link{color:var(--dsw-alias-link,var(--dsw-alias-state-business-primary));text-decoration:none;}
.dsu-link:hover{text-decoration:underline;}
.dsu-error{padding:10px 12px;border:0.5px solid var(--dsw-alias-state-error-primary,#d33);border-radius:var(--dsw-radius-sm);color:var(--dsw-alias-state-error-primary,#d33);}
.dsu-retry{margin-left:8px;padding:2px 10px;border:0.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-sm);background:transparent;color:var(--dsw-alias-label-primary);font-family:inherit;font-size:12px;cursor:pointer;}
.dsu-empty{padding:16px 0;color:var(--dsw-alias-label-tertiary);text-align:center;}
@media (max-width:720px){.dsu-spark{display:none;}}
@media (max-width:560px){.dsu-peak{display:none;}}
`

    /* ---------- formatting ---------- */

    function compact(value) {
      const n = Number(value)
      if (!Number.isFinite(n) || n <= 0) return '0'
      const units = [[1e9, 'B'], [1e6, 'M'], [1e3, 'K'], [1, '']]
      let index = units.findIndex(([size]) => n >= size)
      if (index < 0) index = units.length - 1
      let scaled = n / units[index][0]
      let rounded = scaled >= 100 ? Math.round(scaled) : Math.round(scaled * 10) / 10
      if (rounded >= 1000 && index > 0) {
        index -= 1
        scaled = n / units[index][0]
        rounded = scaled >= 100 ? Math.round(scaled) : Math.round(scaled * 10) / 10
      }
      return `${rounded}${units[index][1]}`
    }

    function exact(value) {
      const n = Number(value)
      return Number.isFinite(n) ? n.toLocaleString() : '—'
    }

    function money(value) {
      const n = Number(value)
      if (!Number.isFinite(n)) return '—'
      if (n === 0) return '0.00'
      if (n < 0.01) return '<0.01'
      return n.toFixed(2)
    }

    function moneyFine(value) {
      const n = Number(value)
      if (!Number.isFinite(n)) return '—'
      if (n === 0) return '0.00'
      if (n < 0.01) return '<0.01'
      return n < 1 ? n.toFixed(4) : n.toFixed(2)
    }

    function percent(value) {
      const n = Number(value)
      if (!Number.isFinite(n) || n <= 0) return '0%'
      const scaled = n * 100
      if (scaled >= 99.9) return '100%'
      if (scaled >= 99) return `${scaled.toFixed(1)}%`
      return `${Math.round(scaled)}%`
    }

    /**
     * Money formatting for the curve, where sub-cent daily costs and
     * per-million rates must stay distinguishable.
     * @param value - CNY amount.
     * @returns a compact but precise amount.
     */
    function curveMoney(value) {
      const n = Number(value)
      if (!Number.isFinite(n)) return '—'
      if (n === 0) return '0'
      if (n < 0.0001) return '<0.0001'
      return n < 1 ? n.toFixed(4) : n.toFixed(2)
    }

    function dayClock(ms) {
      const n = Number(ms)
      if (!Number.isFinite(n)) return '—'
      return new Date(n + BEIJING_OFFSET_MS).toISOString().slice(5, 16).replace('T', ' ')
    }

    function stamp(iso) {
      const ms = Date.parse(String(iso || ''))
      if (!Number.isFinite(ms)) return '—'
      return new Date(ms + BEIJING_OFFSET_MS).toISOString().slice(11, 16)
    }

    /**
     * Active document language reduced to the two dictionaries this plugin
     * ships. Read per request so a boot-order race or a live switch cannot pin
     * the server-localized timeline to the wrong language.
     * @returns 'zh' or 'en'.
     */
    function langOf() {
      const value = String(document.documentElement.lang || 'zh').toLowerCase()
      return value.startsWith('zh') ? 'zh' : 'en'
    }

    /* ---------- shared store ---------- */

    function createStore() {
      const entries = new Map()
      const inflight = new Map()
      const listeners = new Set()
      let snapshot = { version: 0 }

      const emit = () => {
        snapshot = { version: snapshot.version + 1 }
        for (const listener of [...listeners]) {
          try {
            listener()
          } catch (error) {
            // One broken subscriber must not stop the others.
          }
        }
      }

      const keyOf = (scope, days) => `${scope}|${days}`

      const load = (scope, days, force) => {
        const key = keyOf(scope, days)
        const current = entries.get(key)
        if (!force && current && current.data && Date.now() - current.at < ENTRY_TTL_MS) {
          return Promise.resolve(current.data)
        }
        const running = inflight.get(key)
        if (running) return running
        const request = (async () => {
          try {
            const params = new URLSearchParams({ days: String(days), lang: langOf() })
            if (scope.startsWith('session:')) params.set('session', scope.slice(8))
            const response = await fetch(`${ENDPOINT}?${params.toString()}`, {
              cache: 'no-store',
              credentials: 'same-origin',
              headers: { accept: 'application/json' },
            })
            const body = await response.json().catch(() => null)
            if (!response.ok || body === null || body.ok !== true) {
              const code = body && body.code ? String(body.code) : `http-${response.status}`
              throw new Error(code)
            }
            entries.set(key, { data: body, error: null, at: Date.now() })
            emit()
            return body
          } catch (error) {
            const code = error instanceof Error ? error.message : 'error'
            entries.set(key, {
              data: current && current.data ? current.data : null,
              error: code,
              at: current ? current.at : 0,
            })
            emit()
            throw error
          } finally {
            inflight.delete(key)
          }
        })()
        inflight.set(key, request)
        emit()
        return request
      }

      return {
        subscribe(listener) {
          listeners.add(listener)
          return () => {
            listeners.delete(listener)
          }
        },
        getSnapshot: () => snapshot,
        entry: (scope, days) => entries.get(keyOf(scope, days)),
        load,
      }
    }

    const store = createStore()

    function useEntry(scope, days) {
      useSyncExternalStore(store.subscribe, store.getSnapshot)
      useEffect(() => {
        void store.load(scope, days).catch(() => {})
      }, [scope, days])
      return store.entry(scope, days)
    }

    /* ---------- small components ---------- */

    function Sparkline({ days }) {
      const rows = Array.isArray(days) ? days : []
      const max = Math.max(1, ...rows.map(row => Number(row.tokens) || 0))
      const children = rows.map(row => {
        const tokens = Number(row.tokens) || 0
        const height = tokens === 0 ? 2 : Math.max(2, Math.round((tokens / max) * 14))
        return h('span', {
          key: row.day,
          className: 'dsu-spark-bar',
          style: { height: `${height}px`, opacity: tokens === 0 ? 0.25 : 1 },
        })
      })
      return h('span', { className: 'dsu-spark', 'aria-hidden': true }, children)
    }

    function UsageStrip({ t, useSession, useProjection }) {
      if (typeof useSession !== 'function') return h(UsageStripView, { t, sessionId: null, usage: null })
      return h(SessionUsageStrip, { t, useSession, useProjection })
    }

    function SessionUsageStrip({ t, useSession, useProjection }) {
      const sessionId = useSession(state => (state && state.sessionId ? state.sessionId : null))
      return h(SessionUsageStripView, { t, sessionId, useProjection })
    }

    function SessionUsageStripView({ t, sessionId, useProjection }) {
      // The composer's built-in usage pill reads this exact whole-session
      // projection; reuse it so both readings agree instead of deriving a
      // second token total from the Host's log scan.
      const usage = typeof useProjection === 'function' ? useProjection('tokenUsage') : null
      return h(UsageStripView, { t, sessionId, usage })
    }

    function tokenUsageTotal(usage) {
      if (!usage) return null
      const total = (Number(usage.uncachedInputTokens) || 0)
        + (Number(usage.cacheReadTokens) || 0)
        + (Number(usage.cacheWriteTokens) || 0)
        + (Number(usage.outputTokens) || 0)
      return total > 0 ? total : null
    }

    function usageBuckets(usage) {
      if (!usage) return null
      const hit = Number(usage.cacheReadTokens) || 0
      const miss = (Number(usage.uncachedInputTokens) || 0) + (Number(usage.cacheWriteTokens) || 0)
      const out = Number(usage.outputTokens) || 0
      return hit + miss + out > 0 ? { hit, miss, out } : null
    }

    // Rough cost for the built-in token projection. The projection has no
    // per-event model or timestamp, so use the current peak/valley rate and
    // the log's model-family mix. This is deliberately separate from the
    // exact per-event cost below.
    function estimateProjectionCost(usage, pricing, models) {
      const buckets = usageBuckets(usage)
      if (!buckets || !pricing || !Array.isArray(pricing.models) || pricing.models.length === 0) return null
      const shares = new Map()
      let total = 0
      for (const row of models || []) {
        if (!row || !row.family || !(Number(row.tokens) > 0)) continue
        shares.set(row.family, (shares.get(row.family) || 0) + Number(row.tokens))
        total += Number(row.tokens)
      }
      if (total === 0) {
        shares.set('flash', 1)
        total = 1
      }
      let cost = 0
      let priced = 0
      for (const [family, tokens] of shares) {
        const price = pricing.models.find(row => row.family === family)
        if (!price) continue
        const rate = pricing.now && pricing.now.isPeak ? price.peak : price.valley
        const share = tokens / total
        cost += share * ((buckets.hit * rate.hit + buckets.miss * rate.miss + buckets.out * rate.out) / 1e6)
        priced += share
      }
      return priced > 0 ? cost : null
    }

    function UsageStripView({ t, sessionId, usage }) {
      useSyncExternalStore(store.subscribe, store.getSnapshot)
      const scope = sessionId ? `session:${sessionId}` : 'all'
      const days = sessionId ? 0 : 7
      const entry = useEntry(scope, days)
      const [open, setOpen] = useState(false)
      const anchorRef = useRef(null)
      const close = useCallback(() => setOpen(false), [])

      useEffect(() => {
        const tick = () => {
          if (document.visibilityState === 'visible') void store.load(scope, days, true).catch(() => {})
        }
        const timer = window.setInterval(tick, POLL_MS)
        document.addEventListener('visibilitychange', tick)
        return () => {
          window.clearInterval(timer)
          document.removeEventListener('visibilitychange', tick)
        }
      }, [scope, days])

      const data = entry && entry.data
      const unknown = !!(entry && entry.error === 'unknown-session')
      const failed = !data && !!(entry && entry.error) && !unknown
      const today = data ? data.today : null
      const totals = data ? data.range.totals : null
      const pricing = data ? data.pricing : null
      const isPeak = !!(pricing && pricing.now && pricing.now.isPeak)
      const projectionTokens = sessionId ? tokenUsageTotal(usage) : null
      const projectionCost = sessionId ? estimateProjectionCost(usage, pricing, data ? data.range.models : null) : null

      let text = t('loading')
      if (failed) text = t('unavailable')
      else if (unknown) text = t('sessionPending')
      else if (totals && sessionId) {
        const total = `${t('totalApprox')}≈¥${money(totals.cost)}`
        const current = today
          ? `${t('today')} ${compact(today.tokens)} ${t('turnUnit')}≈¥${money(today.cost)}`
          : `${t('today')} —`
        text = `${total}${t('turnSeparator')}${current}`
      }
      else if (today) text = `${t('today')} ${compact(today.tokens)} · ≈¥${money(today.cost)}`

      // The strip leads with the whole-chat cost, then today's tokens and
      // cost. The panel still keeps the two detailed readings.
      const shown = sessionId ? totals : today
      const label = shown
        ? `${sessionId ? t('scopeSession') : t('scopeTitle')}：${t('totalApprox')} ≈¥${moneyFine(shown.cost)}${
          today
            ? `${t('turnSeparator')}${t('today')} ${exact(today.tokens)} ${t('tokens')} ≈¥${moneyFine(today.cost)}`
            : ''
        }${t('turnSeparator')}${isPeak ? t('peak') : t('valley')}`
        : text

      return h(
        React.Fragment,
        null,
        h(
          'button',
          {
            ref: anchorRef,
            type: 'button',
            className: 'dsu-trigger',
            'aria-haspopup': 'dialog',
            'aria-expanded': open,
            'aria-label': label,
            title: label,
            onClick: () => setOpen(value => !value),
          },
          h('span', {
            className: 'dsu-dot',
            'data-peak': String(isPeak),
            'data-loading': String(shown === null),
            'aria-hidden': true,
          }),
          h('span', { className: 'dsu-reading' }, text),
          data ? h(Sparkline, { days: data.sparkline }) : null,
          h('span', { className: 'dsu-more', 'aria-hidden': true }, open ? '▴' : '▾'),
        ),
        open ? h(DetailPanel, { t, anchorRef, onClose: close, sessionId, projectionTokens, projectionCost }) : null,
      )
    }

    function Kpi({ label, value, title }) {
      return h(
        'div',
        { className: 'dsu-kpi', title },
        h('div', { className: 'dsu-kpi-label' }, label),
        h('div', { className: 'dsu-kpi-value' }, value),
      )
    }

    function Composition({ totals, t }) {
      const hit = Number(totals.cacheRead) || 0
      const miss = (Number(totals.input) || 0) + (Number(totals.cacheWrite) || 0)
      const out = Number(totals.output) || 0
      const total = hit + miss + out
      const width = value => (total === 0 ? 0 : (value / total) * 100)
      const segments = [
        ['hit', hit],
        ['miss', miss],
        ['out', out],
      ].filter(([, value]) => value > 0).map(([key, value]) => h('div', {
        key,
        className: `dsu-compose-seg dsu-tone-${key}`,
        style: { width: `${width(value)}%` },
      }))
      return h(
        'div',
        null,
        h('div', { className: 'dsu-compose' }, segments),
        h(
          'div',
          { className: 'dsu-legend' },
          h('span', { className: 'dsu-legend-item', title: exact(hit) },
            h('span', { className: 'dsu-swatch dsu-tone-hit', 'aria-hidden': true }),
            `${t('hit')} ${compact(hit)}`),
          h('span', { className: 'dsu-legend-item', title: exact(miss) },
            h('span', { className: 'dsu-swatch dsu-tone-miss', 'aria-hidden': true }),
            `${t('miss')} ${compact(miss)}`),
          h('span', { className: 'dsu-legend-item', title: exact(out) },
            h('span', { className: 'dsu-swatch dsu-tone-out', 'aria-hidden': true }),
            `${t('output')} ${compact(out)}`),
        ),
      )
    }

    /**
     * Smooth cubic path through points on the 100x40 chart canvas.
     * @param points - ordered `{x, y}` points.
     * @returns SVG path data; empty for no points.
     */
    function smoothPath(points) {
      if (points.length === 0) return ''
      if (points.length === 1) return `M ${points[0].x} ${points[0].y}`
      let path = `M ${points[0].x} ${points[0].y}`
      for (let index = 0; index < points.length - 1; index += 1) {
        const before = points[index - 1] || points[index]
        const current = points[index]
        const next = points[index + 1]
        const after = points[index + 2] || next
        // Clamp each control's y between the segment endpoints so the curve
        // cannot overshoot the plotted maximum.
        const low = Math.min(current.y, next.y)
        const high = Math.max(current.y, next.y)
        const c1x = current.x + (next.x - before.x) / 6
        const c1y = Math.max(low, Math.min(high, current.y + (next.y - before.y) / 6))
        const c2x = next.x - (after.x - current.x) / 6
        const c2y = Math.max(low, Math.min(high, next.y - (after.y - current.y) / 6))
        path += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${next.x} ${next.y}`
      }
      return path
    }

    /**
     * Cost or effective-price curve for the daily range.
     * `cost` plots the estimated CNY per day; `unit` plots the effective
     * CNY-per-million-token rate, which reflects peak/off-peak mix and official
     * price changes. Days without a priced usage report become gaps.
     * @param rows - daily rows from the Host.
     * @param t - locale seat.
     * @returns the curve block with its mode toggle.
     */
    function CostCurve({ rows, t }) {
      const [mode, setMode] = useState('cost')
      const xFor = index => ((index + 0.5) / rows.length) * 100
      const values = rows.map(row => {
        if (Number(row.unpricedTokens) > 0) return null
        if (mode === 'cost') return Number(row.cost) || 0
        if (!row.tokens) return null
        return ((Number(row.cost) || 0) / row.tokens) * 1e6
      })
      const known = values.filter(value => value !== null)
      const hasKnown = known.length > 0
      const max = hasKnown ? Math.max(...known) : 0
      const points = values.map((value, index) => {
        if (value === null) return null
        const x = xFor(index)
        const y = 40 - (max === 0 ? 0 : (value / max) * 36)
        return { x, y, value, row: rows[index] }
      })
      const runs = []
      let run = []
      for (const point of points) {
        if (point === null) {
          if (run.length > 0) runs.push(run)
          run = []
        } else {
          run.push(point)
        }
      }
      if (run.length > 0) runs.push(run)
      const singles = runs.filter(runPoints => runPoints.length === 1).map(runPoints => runPoints[0])
      const hasGaps = values.some(value => value === null)
      const label = mode === 'cost' ? t('dailyCost') : t('unitPrice')
      const maxText = !hasKnown ? '—' : mode === 'cost' ? `≈¥${curveMoney(max)}` : `¥${curveMoney(max)}/M`
      const textFor = value => value === null
        ? null
        : mode === 'cost' ? `≈¥${curveMoney(value)}` : `¥${curveMoney(value)}/M`
      const gapReason = index => (Number(rows[index].tokens) === 0 ? t('gapNoUsage') : t('gapUnpriced'))
      return h(
        'div',
        { className: 'dsu-curve-block' },
        h('div', { className: 'dsu-curve-head' },
          h('span', { className: 'dsu-curve-caption' }, `${label} · ${t('curveMax')} ${maxText}`),
          h('span', { className: 'dsu-toggle', role: 'group', 'aria-label': t('curveMode') },
            h('button', {
              type: 'button',
              className: 'dsu-toggle-btn',
              'aria-pressed': mode === 'cost',
              title: t('dailyCost'),
              onClick: () => setMode('cost'),
            }, t('curveCost')),
            h('button', {
              type: 'button',
              className: 'dsu-toggle-btn',
              'aria-pressed': mode === 'unit',
              title: t('unitPrice'),
              onClick: () => setMode('unit'),
            }, t('curveUnit')))),
        hasKnown
          ? h('div', {
            className: 'dsu-curve',
            role: 'img',
            'aria-label': `${label} · ${t('curveMax')} ${maxText} · ${rows.length > 0 ? rows[0].day : ''} – ${rows.length > 0 ? rows[rows.length - 1].day : ''}`,
          },
          h('svg', {
            viewBox: '0 0 100 40',
            preserveAspectRatio: 'none',
            width: '100%',
            height: '100%',
            'aria-hidden': true,
          },
          runs.map((runPoints, index) => h(React.Fragment, { key: index },
            runPoints.length > 1
              ? h('path', {
                className: 'dsu-curve-area',
                d: `${smoothPath(runPoints)} L ${runPoints[runPoints.length - 1].x} 40 L ${runPoints[0].x} 40 Z`,
              })
              : null,
            h('path', {
              className: 'dsu-curve-line',
              d: smoothPath(runPoints),
              vectorEffect: 'non-scaling-stroke',
            }),
          )),
          rows.map((row, index) => {
            const width = 100 / rows.length
            const value = values[index]
            return h('rect', {
              key: row.day,
              x: index * width,
              y: 0,
              width,
              height: 40,
              fill: 'transparent',
              pointerEvents: 'all',
            }, h('title', null, value === null
              ? `${row.day} · ${gapReason(index)}`
              : `${row.day} · ${textFor(value)} · ${exact(row.tokens)} ${t('kpiTokens')}`))
          })),
          singles.map(point => h('span', {
            key: point.row.day,
            className: 'dsu-curve-dot',
            'aria-hidden': true,
            style: { left: `${point.x}%`, top: `${(point.y / 40) * 100}%` },
            title: textFor(point.value) || '',
          })))
          : h('div', { className: 'dsu-empty' }, t('noPriced')),
        hasGaps ? h('div', { className: 'dsu-note' }, t('gapNote')) : null,
        h('ul', { className: 'dsu-sr' }, rows.map((row, index) => h('li', { key: row.day },
          `${row.day}: ${values[index] === null ? gapReason(index) : textFor(values[index])}`))),
      )
    }

    function DailyChart({ series, t }) {
      const rows = Array.isArray(series) ? series : []
      const maxTokens = Math.max(1, ...rows.map(row => Number(row.tokens) || 0))
      const totalTokens = rows.reduce((sum, row) => sum + (Number(row.tokens) || 0), 0)
      const labelCount = Math.min(5, rows.length)
      const labels = []
      if (rows.length > 0) {
        for (let index = 0; index < labelCount; index += 1) {
          const at = labelCount === 1 ? 0 : Math.round(((rows.length - 1) * index) / (labelCount - 1))
          labels.push({ at, text: rows[at].day.slice(5), day: rows[at].day })
        }
      }
      return h(
        'div',
        { className: 'dsu-chart' },
        h(
          'div',
          {
            className: 'dsu-bars',
            role: 'img',
            'aria-label': `${t('daily')} ${rows.length > 0 ? rows[0].day : ''} – ${rows.length > 0 ? rows[rows.length - 1].day : ''}: ${exact(totalTokens)} tokens`,
          },
          rows.map(row => {
            const tokens = Number(row.tokens) || 0
            const hit = tokens === 0 ? 0 : ((Number(row.cacheRead) || 0) / tokens) * 100
            const miss = tokens === 0 ? 0 : (((Number(row.input) || 0) + (Number(row.cacheWrite) || 0)) / tokens) * 100
            const out = tokens === 0 ? 0 : ((Number(row.output) || 0) / tokens) * 100
            const tooltip = `${row.day} · ${exact(tokens)} tokens · ¥${moneyFine(row.cost)} · ${t('requests')} ${row.requests}`
            return h(
              'div',
              { key: row.day, className: 'dsu-col', title: tooltip },
              tokens === 0
                ? h('div', { className: 'dsu-seg-empty' })
                : h(
                  'div',
                  { className: 'dsu-stack', style: { height: `${Math.max(2, (tokens / maxTokens) * 100)}%` } },
                  h('div', { className: 'dsu-seg dsu-tone-hit', style: { height: `${hit}%` } }),
                  h('div', { className: 'dsu-seg dsu-tone-miss', style: { height: `${miss}%` } }),
                  h('div', { className: 'dsu-seg dsu-tone-out', style: { height: `${out}%` } }),
                ),
            )
          }),
        ),
        h(CostCurve, { rows, t }),
        h(
          'div',
          { className: 'dsu-axis', 'aria-hidden': true },
          labels.map(label => {
            const last = label.at === rows.length - 1
            const style = label.at === 0
              ? { left: 0 }
              : last
                ? { right: 0 }
                : { left: `${((label.at + 0.5) / rows.length) * 100}%`, transform: 'translateX(-50%)' }
            return h('span', { key: label.at, style, title: label.day }, label.text)
          }),
        ),
      )
    }

    function ModelTable({ models, t }) {
      const rows = Array.isArray(models) ? models : []
      if (rows.length === 0) return h('div', { className: 'dsu-empty' }, t('noData'))
      return h(
        'div',
        { className: 'dsu-table-wrap' },
        h(
          'table',
          { className: 'dsu-table' },
          h('thead', null, h('tr', null,
            h('th', null, t('model')),
            h('th', null, t('requests')),
            h('th', null, t('hit')),
            h('th', null, t('miss')),
            h('th', null, t('output')),
            h('th', null, t('tokens')),
            h('th', null, t('cost')),
            h('th', null, t('share')))),
          h('tbody', null, rows.map(row => h(
            'tr',
            { key: `${row.provider}\u0000${row.model}` },
            h('td', { className: 'dsu-strong', title: row.provider || '' }, row.model || t('unknownModel')),
            h('td', null, String(row.requests)),
            h('td', { title: exact(row.cacheRead) }, compact(row.cacheRead)),
            h('td', { title: exact((row.input || 0) + (row.cacheWrite || 0)) }, compact((row.input || 0) + (row.cacheWrite || 0))),
            h('td', { title: exact(row.output) }, compact(row.output)),
            h('td', { className: 'dsu-strong', title: exact(row.tokens) }, compact(row.tokens)),
            h('td', { className: 'dsu-strong' }, row.cost === null ? '—' : `¥${moneyFine(row.cost)}`),
            h('td', null, percent(row.share)),
          ))),
        ),
      )
    }

    function PriceCard({ pricing, t }) {
      const now = pricing.now || {}
      const models = Array.isArray(pricing.models) ? pricing.models : []
      const changes = Array.isArray(pricing.changes) ? pricing.changes : []
      const rows = []
      for (const model of models) {
        for (const side of ['valley', 'peak']) {
          const price = model[side]
          if (!price) continue
          rows.push(h('tr', { key: `${model.family}-${side}` },
            h('td', { className: 'dsu-strong' }, model.label),
            h('td', null, side === 'valley' ? t('valleyPrice') : t('peakPrice')),
            h('td', null, String(price.hit)),
            h('td', null, String(price.miss)),
            h('td', null, String(price.out))))
        }
      }
      return h(
        'div',
        null,
        h('div', { className: 'dsu-status' },
          h('span', { className: 'dsu-dot', 'data-peak': String(!!now.isPeak), 'aria-hidden': true }),
          h('span', null, now.isPeak ? t('nowPeak') : t('nowValley')),
          Number.isFinite(Number(now.nextChangeAt)) && now.nextChangeAt != null
            ? h('span', { className: 'dsu-time' }, `${t('nextSwitch')} ${dayClock(now.nextChangeAt)}`)
            : null),
        h(
          'table',
          { className: 'dsu-price-table' },
          h('thead', null, h('tr', null,
            h('th', null, t('model')),
            h('th', null, ''),
            h('th', null, t('priceHit')),
            h('th', null, t('priceMiss')),
            h('th', null, t('priceOut')))),
          h('tbody', null, rows),
        ),
        h('div', { className: 'dsu-note' }, t('perMillion')),
        pricing.sourceUrl
          ? h('div', { className: 'dsu-note' },
            h('a', { className: 'dsu-link', href: pricing.sourceUrl, target: '_blank', rel: 'noopener noreferrer' }, t('priceSource')))
          : null,
        h('div', { className: 'dsu-section-title', style: { marginTop: '10px' } },
          t('changes'),
          h('span', { className: 'dsu-rule' })),
        h('ul', { className: 'dsu-changes' },
          changes.map(change => h('li', { key: change.date, className: 'dsu-change' },
            h('span', { className: 'dsu-change-date' }, change.date),
            h('span', { className: 'dsu-change-body' },
              h('div', { className: 'dsu-change-title' }, change.title),
              h('div', { className: 'dsu-change-detail' }, change.detail))))),
      )
    }

    function DetailPanel({ t, anchorRef, onClose, sessionId, projectionTokens, projectionCost }) {
      useSyncExternalStore(store.subscribe, store.getSnapshot)
      const [scopeMode, setScopeMode] = useState(sessionId ? 'session' : 'all')
      const [days, setDays] = useState(sessionId ? 0 : 7)
      const scope = scopeMode === 'session' && sessionId ? `session:${sessionId}` : 'all'
      const entry = useEntry(scope, days)
      const chooseScope = mode => {
        setScopeMode(mode)
        setDays(mode === 'session' ? 0 : 7)
      }
      const panelRef = useRef(null)
      const restoreFocus = useRef(null)
      const [position, setPosition] = useState(null)

      useLayoutEffect(() => {
        const anchor = anchorRef.current
        if (!anchor) return undefined
        const place = () => {
          const rect = anchor.getBoundingClientRect()
          const overlayTop = Math.max(
            12,
            Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dsh-frame-overlay-top')) || 12,
          )
          const width = Math.min(680, Math.max(280, window.innerWidth - 24))
          const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))
          const bottom = Math.max(12, window.innerHeight - rect.top + 8)
          const maxHeight = Math.max(
            120,
            Math.min(rect.top - 8 - overlayTop, window.innerHeight - overlayTop - 12),
          )
          setPosition({ left, bottom, width, maxHeight })
        }
        place()
        window.addEventListener('resize', place)
        window.addEventListener('scroll', place, true)
        return () => {
          window.removeEventListener('resize', place)
          window.removeEventListener('scroll', place, true)
        }
      }, [anchorRef])

      useEffect(() => {
        const tick = () => {
          if (document.visibilityState === 'visible') void store.load(scope, days, true).catch(() => {})
        }
        const timer = window.setInterval(tick, POLL_MS)
        document.addEventListener('visibilitychange', tick)
        return () => {
          window.clearInterval(timer)
          document.removeEventListener('visibilitychange', tick)
        }
      }, [scope, days])

      useEffect(() => {
        restoreFocus.current = document.activeElement
        const panel = panelRef.current
        if (panel) panel.focus()
        const onKeyDown = event => {
          if (event.key === 'Escape') {
            event.preventDefault()
            onClose()
          }
        }
        const outside = event => {
          const panel = panelRef.current
          const anchor = anchorRef.current
          if (panel && panel.contains(event.target)) return
          if (anchor && anchor.contains(event.target)) return
          onClose()
        }
        document.addEventListener('keydown', onKeyDown)
        document.addEventListener('pointerdown', outside, true)
        document.addEventListener('click', outside, true)
        return () => {
          document.removeEventListener('keydown', onKeyDown)
          document.removeEventListener('pointerdown', outside, true)
          document.removeEventListener('click', outside, true)
          const target = restoreFocus.current
          if (target && typeof target.focus === 'function') target.focus()
        }
      }, [anchorRef, onClose])

      const data = entry && entry.data
      const error = entry && entry.error
      const selected = [
        { value: 1, label: 'rangeToday' },
        { value: 7, label: 'range7' },
        { value: 30, label: 'range30' },
        { value: 0, label: 'rangeAll' },
      ]

      const isSession = scopeMode === 'session' && !!sessionId
      const unknown = !data && error === 'unknown-session'
      let body
      if (unknown) {
        body = h('div', { className: 'dsu-error' },
          t('sessionPending'),
          h('button', {
            type: 'button',
            className: 'dsu-retry',
            onClick: () => { void store.load(scope, days, true).catch(() => {}) },
          }, t('retry')))
      } else if (!data && error) {
        body = h('div', { className: 'dsu-error' },
          `${t('error')} (${error})`,
          h('button', {
            type: 'button',
            className: 'dsu-retry',
            onClick: () => { void store.load(scope, days, true).catch(() => {}) },
          }, t('retry')))
      } else if (!data) {
        body = h('div', { className: 'dsu-empty' }, t('loading'))
      } else {
        const totals = data.range.totals
        const todayStats = data.today
        const unpriced = Number(totals.unpricedTokens) > 0
        const failedSessions = data.meta && data.meta.sessions ? Number(data.meta.sessions.failed) || 0 : 0
        const tokenTotal = isSession && days === 0 && projectionTokens !== null
          ? projectionTokens
          : totals.tokens
        const series = data.range.days === 0 && data.range.series.length > 90
          ? data.range.series.slice(-90)
          : data.range.series
        body = h(
          React.Fragment,
          null,
          error ? h('div', { className: 'dsu-stale' }, t('stale')) : null,
          failedSessions > 0
            ? h('div', { className: 'dsu-note' }, `${t('partial')} (${failedSessions})`)
            : null,
          isSession && days === 0 && projectionTokens !== null
            ? h(
              'div',
              { className: 'dsu-dual' },
              h(
                'div',
                { className: 'dsu-block' },
                h('div', { className: 'dsu-block-title' }, t('readyBlock')),
                h('div', { className: 'dsu-block-main' }, compact(tokenTotal), h('span', { className: 'dsu-block-unit' }, ' tokens')),
                h('div', { className: 'dsu-block-sub' }, `${t('readyEstimate')} ≈¥${projectionCost !== null ? moneyFine(projectionCost) : '—'}`),
                h('div', { className: 'dsu-block-note' }, t('readyBlockNote')),
              ),
              h(
                'div',
                { className: 'dsu-block' },
                h('div', { className: 'dsu-block-title' }, t('exactBlock')),
                h('div', { className: 'dsu-block-main' }, `${unpriced ? '≈' : ''}¥${moneyFine(totals.cost)}`),
                h('div', { className: 'dsu-block-sub' },
                  `${compact(totals.tokens)} tokens · ${totals.requests} ${t('kpiRequests')} · ${t('kpiCache')} ${percent(totals.cacheHitRate)}`),
                todayStats
                  ? h('div', { className: 'dsu-block-sub' },
                    `${t('today')} ${compact(todayStats.tokens)} ${t('turnUnit')}≈¥${moneyFine(todayStats.cost)}`)
                  : null,
                h('div', { className: 'dsu-block-note' }, t('exactBlockNote')),
              ),
            )
            : h(
              'div',
              { className: 'dsu-kpis' },
              h(Kpi, { label: isSession ? t('kpiSessionCost') : t('kpiCost'), value: unpriced ? `≈¥${moneyFine(totals.cost)}` : `¥${moneyFine(totals.cost)}` }),
              h(Kpi, { label: isSession ? t('kpiSessionTokens') : t('kpiTokens'), value: compact(tokenTotal), title: `${exact(tokenTotal)} tokens` }),
              h(Kpi, { label: t('kpiRequests'), value: String(totals.requests) }),
              h(Kpi, { label: t('kpiCache'), value: percent(totals.cacheHitRate) }),
            ),
          h('div', { className: 'dsu-section' },
            h('div', { className: 'dsu-section-title' }, t('composition'), h('span', { className: 'dsu-rule' })),
            h(Composition, { totals, t })),
          data.range.days === 1 ? null : h('div', { className: 'dsu-section' },
            h('div', { className: 'dsu-section-title' }, t('daily'), h('span', { className: 'dsu-rule' })),
            h(DailyChart, { series, t }),
            data.range.days === 0 && data.range.series.length > 90
              ? h('div', { className: 'dsu-note' }, t('chartWindow'))
              : null,
            data.range.truncated ? h('div', { className: 'dsu-note' }, t('moreDays')) : null),
          h('div', { className: 'dsu-section' },
            h('div', { className: 'dsu-section-title' }, t('models'), h('span', { className: 'dsu-rule' })),
            h(ModelTable, { models: data.range.models, t })),
          unpriced ? h('div', { className: 'dsu-note' }, t('unpriced')) : null,
          h('div', { className: 'dsu-section' },
            h('div', { className: 'dsu-section-title' }, t('price'), h('span', { className: 'dsu-rule' })),
            h(PriceCard, { pricing: data.pricing, t })),
          h('div', { className: 'dsu-note' }, t('noteEstimate')),
          h('div', { className: 'dsu-note' }, isSession ? t('sessionNote') : t('noteScope')),
          h('div', { className: 'dsu-foot' },
            h('a', {
              className: 'dsu-link',
              href: data.meta && data.meta.platformUsageUrl ? data.meta.platformUsageUrl : 'https://platform.deepseek.com/usage',
              target: '_blank',
              rel: 'noopener noreferrer',
            }, t('openPlatform'))),
        )
      }

      const panelTitle = isSession ? `${t('scopeSession')} · ${t('title')}` : t('title')
      return createPortal(
        h(
          'div',
          {
            ref: panelRef,
            className: 'dsu-panel',
            role: 'dialog',
            'aria-modal': 'false',
            'aria-label': panelTitle,
            'aria-busy': data === null,
            tabIndex: -1,
            style: position === null
              ? { left: '12px', bottom: '12px', width: '320px', opacity: 0 }
              : {
                left: `${position.left}px`,
                bottom: `${position.bottom}px`,
                width: `${position.width}px`,
                maxHeight: `${position.maxHeight}px`,
              },
          },
          h('div', { className: 'dsu-head' },
            h('span', { className: 'dsu-title' }, panelTitle),
            h('span', { className: 'dsu-time' }, data ? `${t('updated')} ${stamp(data.generatedAt)}` : ''),
            h('button', {
              type: 'button',
              className: 'dsu-icon',
              'aria-label': t('refresh'),
              title: t('refresh'),
              onClick: () => { void store.load(scope, days, true).catch(() => {}) },
            }, '↻'),
            h('button', {
              type: 'button',
              className: 'dsu-close',
              'aria-label': t('close'),
              title: t('close'),
              onClick: onClose,
            }, '×')),
          sessionId
            ? h('div', { className: 'dsu-scopes' },
              h('button', {
                type: 'button',
                className: 'dsu-scope',
                'aria-pressed': scopeMode === 'session',
                onClick: () => chooseScope('session'),
              }, t('scopeSession')),
              h('button', {
                type: 'button',
                className: 'dsu-scope',
                'aria-pressed': scopeMode === 'all',
                onClick: () => chooseScope('all'),
              }, t('scopeAll')))
            : null,
          h('div', { className: 'dsu-ranges' },
            selected.map(option => h('button', {
              key: option.value,
              type: 'button',
              className: 'dsu-range',
              'aria-pressed': days === option.value,
              onClick: () => setDays(option.value),
            }, t(option.label)))),
          h('div', { className: 'dsu-body' }, body),
        ),
        document.body,
      )
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-usage: dictionaries')
        ctx.effect(() => {
          const style = document.createElement('style')
          style.dataset.dshUsage = '1'
          style.textContent = CSS
          document.head.appendChild(style)
          return () => {
            style.remove()
          }
        }, 'dsh-usage: styles')
        ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
          name: 'conversation.composer.dock',
          id: 'usage-strip',
          order: 5,
          locale: NS,
        }, UsageStrip))
      },
    }
  },
})
