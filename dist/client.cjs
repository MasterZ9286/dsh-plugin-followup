/**
 * dsh-plugin-followup — 划词追问（浏览器半区）
 *
 * 用法：在任意一条已完成的回答里选中文字 → 右键 → 「追问（右侧面板）」。
 * 追问卡片住在原生右栏（按会话独立），回答全文镜像回卡片，主对话中该轮被隐藏。
 *
 * 本文件是可被 harness Web 插件表加载的自包含包：外层是 __ModuleLoader__ 契约，
 * 内层就是可读的插件实现（未压缩）。本插件是纯客户端插件，无 host 半区逻辑。
 */
window.__ModuleLoader__.load({
  id: `dsh-plugin-followup`,
  factory: (require) => {
    const React = require(`react`)
    const module = { exports: {} }
    const exports = module.exports

    const NAME = `dsh-plugin-followup`
    const TAG = `[${NAME}] `
    const STYLE_ATTR = `data-dsh-plugin-followup`

    /** 插入一段包拥有的样式，返回移除器。 */
    function insertStyle(css) {
      const el = document.createElement(`style`)
      el.setAttribute(STYLE_ATTR, ``)
      el.textContent = css
      document.head.appendChild(el)
      return () => { el.remove() }
    }

    /**
     * 面板自带的极简 Markdown 渲染器（零外部依赖）。
     *
     * 不用产品内部的 MarkdownText：那个组件在真实的模块加载器里会去动态加载
     * shiki / katex 等资源，拿不到时会在渲染期抛错，把整块面板拖黑。
     * 这里覆盖回答里最常见的语法：代码块围栏、行内代码、标题、列表、引用、
     * 分割线、粗体/斜体、链接、表格。
     */
    function renderInline(text, keyPrefix) {
      const nodes = []
      const pattern = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(\*[^*\n]+\*)|(\[[^\]\n]+\]\((https?:\/\/[^\s)]+)\))/g
      let last = 0
      let n = 0
      let match = pattern.exec(text)
      while (match !== null) {
        if (match.index > last) nodes.push(text.slice(last, match.index))
        if (match[1] !== undefined) nodes.push(React.createElement(`code`, { className: `dsh-followup-inline-code`, key: keyPrefix + `-c` + String(n) }, match[1].slice(1, -1)))
        else if (match[2] !== undefined) nodes.push(React.createElement(`strong`, { key: keyPrefix + `-b` + String(n) }, match[2].slice(2, -2)))
        else if (match[3] !== undefined) nodes.push(React.createElement(`em`, { key: keyPrefix + `-i` + String(n) }, match[3].slice(1, -1)))
        else if (match[4] !== undefined) nodes.push(React.createElement(`a`, { className: `dsh-followup-a`, href: match[5], target: `_blank`, rel: `noreferrer`, key: keyPrefix + `-a` + String(n) }, match[4].slice(1, match[4].indexOf(`]`))))
        n += 1
        last = pattern.lastIndex
        match = pattern.exec(text)
      }
      if (last < text.length) nodes.push(text.slice(last))
      const out = []
      for (const node of nodes) {
        if (typeof node !== `string`) { out.push(node); continue }
        const parts = node.split(`\n`)
        for (let i = 0; i < parts.length; i += 1) {
          if (i > 0) out.push(React.createElement(`br`, { key: keyPrefix + `-br` + String(n) + `-` + String(i) }))
          if (parts[i] !== ``) out.push(parts[i])
        }
      }
      return out
    }

    function renderMarkdown(source, keyPrefix) {
      const lines = String(source === null || source === undefined ? `` : source).replace(/\r\n?/g, `\n`).split(`\n`)
      const out = []
      let i = 0
      let k = 0
      const nextKey = () => { k += 1; return keyPrefix + `-` + String(k) }
      while (i < lines.length) {
        const line = lines[i]
        const fence = /^\s*(```|~~~)\s*([^\s`]*)\s*$/.exec(line)
        if (fence !== null) {
          const marker = fence[1]
          const lang = fence[2]
          const body = []
          i += 1
          while (i < lines.length && lines[i].trim().indexOf(marker) !== 0) { body.push(lines[i]); i += 1 }
          i += 1
          const kids = []
          if (lang !== ``) kids.push(React.createElement(`div`, { className: `dsh-followup-code-lang`, key: `lang` }, lang))
          kids.push(React.createElement(`pre`, { className: `dsh-followup-code-pre`, key: `pre` }, React.createElement(`code`, null, body.join(`\n`))))
          out.push(React.createElement(`div`, { className: `dsh-followup-code`, key: nextKey() }, kids))
          continue
        }
        const heading = /^(#{1,6})\s+(.*)$/.exec(line)
        if (heading !== null) {
          const level = heading[1].length
          out.push(React.createElement(`div`, { className: `dsh-followup-h dsh-followup-h` + String(level), key: nextKey() }, renderInline(heading[2], nextKey())))
          i += 1
          continue
        }
        if (/^\s*([-*_])\s*\1\s*\1[\s\-*_]*$/.test(line)) {
          out.push(React.createElement(`hr`, { className: `dsh-followup-hr`, key: nextKey() }))
          i += 1
          continue
        }
        if (/^\s*>\s?/.test(line)) {
          const body = []
          while (i < lines.length && /^\s*>\s?/.test(lines[i])) { body.push(lines[i].replace(/^\s*>\s?/, ``)); i += 1 }
          out.push(React.createElement(`div`, { className: `dsh-followup-bq`, key: nextKey() }, renderMarkdown(body.join(`\n`), nextKey())))
          continue
        }
        if (/^\s*([-*+]|\d+[.)])\s+/.test(line)) {
          const ordered = /^\s*\d+[.)]\s+/.test(line)
          const items = []
          while (i < lines.length && /^\s*([-*+]|\d+[.)])\s+/.test(lines[i])) {
            items.push(lines[i].replace(/^\s*([-*+]|\d+[.)])\s+/, ``))
            i += 1
          }
          out.push(React.createElement(ordered ? `ol` : `ul`, { className: `dsh-followup-list`, key: nextKey() },
            items.map((item, idx) => React.createElement(`li`, { key: `li` + String(idx) }, renderInline(item, nextKey())))))
          continue
        }
        if (line.indexOf(`|`) !== -1 && i + 1 < lines.length && lines[i + 1].indexOf(`-`) !== -1 && /^\s*\|?[\s:|-]*-[\s:|-]*\|?[\s:|-]*$/.test(lines[i + 1])) {
          const splitRow = (raw) => raw.replace(/^\s*\|/, ``).replace(/\|\s*$/, ``).split(`|`).map((cell) => cell.trim())
          const head = splitRow(line)
          i += 2
          const rows = []
          while (i < lines.length && lines[i].indexOf(`|`) !== -1 && lines[i].trim() !== ``) { rows.push(splitRow(lines[i])); i += 1 }
          out.push(React.createElement(`table`, { className: `dsh-followup-table`, key: nextKey() },
            React.createElement(`thead`, null, React.createElement(`tr`, null, head.map((cell, idx) => React.createElement(`th`, { key: `th` + String(idx) }, renderInline(cell, nextKey()))))),
            React.createElement(`tbody`, null, rows.map((row, rIdx) => React.createElement(`tr`, { key: `tr` + String(rIdx) }, row.map((cell, cIdx) => React.createElement(`td`, { key: `td` + String(cIdx) }, renderInline(cell, nextKey()))))))))
          continue
        }
        if (line.trim() === ``) { i += 1; continue }
        const para = []
        while (i < lines.length && lines[i].trim() !== `` &&
          /^\s*([-*+]|\d+[.)])\s+/.test(lines[i]) === false &&
          /^\s*>\s?/.test(lines[i]) === false &&
          /^#{1,6}\s+/.test(lines[i]) === false &&
          /^\s*(```|~~~)/.test(lines[i]) === false) {
          para.push(lines[i])
          i += 1
        }
        out.push(React.createElement(`p`, { className: `dsh-followup-p`, key: nextKey() }, renderInline(para.join(`\n`), nextKey())))
      }
      return out
    }

    /** 面板级错误边界：渲染异常退化成一行提示，不让整块面板变黑。 */
    class PanelBoundary extends React.Component {
      constructor(props) {
        super(props)
        this.state = { error: null }
      }
      static getDerivedStateFromError(error) {
        return { error }
      }
      componentDidCatch(error) {
        console.error(`[dsh-plugin-followup] 面板渲染异常（已隔离）`, error)
      }
      render() {
        if (this.state.error !== null) {
          const message = this.state.error !== null && this.state.error !== undefined && this.state.error.message !== undefined
            ? String(this.state.error.message)
            : String(this.state.error)
          return React.createElement(`div`, { className: `dsh-followup-empty` }, `追问面板渲染出错，已隔离（对话不受影响）：` + message)
        }
        return this.props.children
      }
    }

    const CSS = [
      `.dsh-followup-menu{position:fixed;z-index:2147483646;box-sizing:border-box;min-width:184px;max-width:264px;padding:6px;border-radius:12px;background:var(--dsw-alias-bg-overlay,#fff);border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.08));box-shadow:0 10px 30px rgba(0,0,0,.18);display:flex;flex-direction:column;gap:2px;pointer-events:auto;font-family:inherit;font-size:13px;line-height:1.4;color:var(--dsw-alias-label-primary,#111)}`,
      `.dsh-followup-preview{max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-secondary,#888);font-size:12px;padding:4px 8px 6px;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.06));margin-bottom:4px}`,
      `.dsh-followup-item{display:flex;align-items:center;gap:8px;width:100%;box-sizing:border-box;padding:7px 9px;border:0;border-radius:8px;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer;appearance:none}`,
      `.dsh-followup-item:hover{background:var(--dsw-alias-bg-layer-2,rgba(0,0,0,.05))}`,
      `.dsh-followup-item[data-primary="true"]{color:var(--dsw-alias-brand-primary,#4d6bfe);font-weight:500}`,
      `.dsh-followup-panel{position:fixed;top:0;right:0;bottom:0;z-index:2147483000;box-sizing:border-box;pointer-events:auto;display:flex;flex-direction:column;background:var(--dsw-alias-bg-base,#fff);border-left:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.1));box-shadow:-8px 0 24px rgba(0,0,0,.06);font-family:inherit;font-size:13px;line-height:1.5;color:var(--dsw-alias-label-primary,#111)}`,
      `.dsh-followup-panel--inline{position:relative;top:auto;right:auto;bottom:auto;left:auto;width:100%;height:100%;min-height:0;border-left:0;box-shadow:none;background:transparent}`,
      `.dsh-followup-panel-head{display:flex;align-items:center;gap:6px;padding:9px 12px;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.08))}`,
      `.dsh-followup-panel-title{font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}`,
      `.dsh-followup-panel-count{color:var(--dsw-alias-label-secondary,#888);font-size:12px;font-weight:400}`,
      `.dsh-followup-mini{border:0;background:transparent;color:var(--dsw-alias-label-secondary,#888);font:inherit;font-size:12px;cursor:pointer;padding:2px 6px;border-radius:6px;appearance:none;white-space:nowrap}`,
      `.dsh-followup-mini:hover{background:var(--dsw-alias-bg-layer-2,rgba(0,0,0,.05));color:var(--dsw-alias-label-primary,#111)}`,
      `.dsh-followup-link{color:var(--dsw-alias-brand-primary,#4d6bfe)}`,
      `.dsh-followup-toggle{border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.1));background:transparent;color:var(--dsw-alias-label-secondary,#666);font:inherit;font-size:12px;cursor:pointer;padding:3px 9px;border-radius:8px;appearance:none;white-space:nowrap}`,
      `.dsh-followup-toggle:hover{background:var(--dsw-alias-bg-layer-2,rgba(0,0,0,.05));color:var(--dsw-alias-label-primary,#111)}`,
      `.dsh-followup-toggle[data-on="true"]{border-color:var(--dsw-alias-brand-primary,#4d6bfe);color:var(--dsw-alias-brand-primary,#4d6bfe)}`,
      `.dsh-followup-panel-body{flex:1;min-height:0;overflow-y:auto;padding:10px;display:flex;flex-direction:column;gap:10px}`,
      `.dsh-followup-card{border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.08));border-radius:12px;background:var(--dsw-alias-bg-layer-1,rgba(0,0,0,.02));padding:10px;display:flex;flex-direction:column;gap:8px;box-shadow:0 1px 2px rgba(0,0,0,.03)}`,
      `.dsh-followup-card-head{display:flex;align-items:center;gap:8px;font-size:11px;color:var(--dsw-alias-label-tertiary,#999)}`,
      `.dsh-followup-badge{background:var(--dsw-alias-bg-layer-2,rgba(0,0,0,.05));border-radius:999px;padding:1px 7px;font-size:11px;color:var(--dsw-alias-label-secondary,#777)}`,
      `.dsh-followup-block{display:flex;flex-direction:column;gap:2px;min-width:0}`,
      `.dsh-followup-block>.dsh-followup-mini{align-self:flex-start;padding-left:0}`,
      `.dsh-followup-label{font-size:11px;color:var(--dsw-alias-label-tertiary,#999)}`,
      `.dsh-followup-quote{border-left:2px solid var(--dsw-alias-brand-primary,#4d6bfe);padding:1px 0 1px 8px;color:var(--dsw-alias-label-secondary,#666);font-size:12px;line-height:1.6}`,
      `.dsh-followup-asked{font-size:12px;color:var(--dsw-alias-label-primary,#111)}`,
      `.dsh-followup-answer{font-size:12px;line-height:1.7;padding:6px 8px;border-radius:8px;background:var(--dsw-alias-bg-layer-2,rgba(0,0,0,.04))}`,
      `.dsh-followup-md{font-size:12px;line-height:1.7;min-width:0;overflow-wrap:anywhere}`,
      `.dsh-followup-md>*:first-child{margin-top:0}`,
      `.dsh-followup-md>*:last-child{margin-bottom:0}`,
      `.dsh-followup-p{margin:0 0 6px}`,
      `.dsh-followup-h{font-weight:600;margin:8px 0 4px}`,
      `.dsh-followup-h1{font-size:14px}`,
      `.dsh-followup-h2{font-size:13.5px}`,
      `.dsh-followup-h3{font-size:13px}`,
      `.dsh-followup-h4,.dsh-followup-h5,.dsh-followup-h6{font-size:12.5px}`,
      `.dsh-followup-code{border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.1));border-radius:8px;overflow:hidden;margin:6px 0;background:var(--dsw-alias-bg-layer-2,rgba(0,0,0,.04))}`,
      `.dsh-followup-code-lang{font-size:10.5px;color:var(--dsw-alias-label-tertiary,#999);padding:3px 8px;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.08))}`,
      `.dsh-followup-code-pre{margin:0;padding:7px 8px;overflow-x:auto;max-width:100%}`,
      `.dsh-followup-code-pre code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11.5px;line-height:1.6;white-space:pre}`,
      `.dsh-followup-inline-code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11.5px;padding:1px 4px;border-radius:4px;background:var(--dsw-alias-bg-layer-2,rgba(0,0,0,.06))}`,
      `.dsh-followup-list{margin:0 0 6px;padding-left:18px}`,
      `.dsh-followup-bq{margin:4px 0;padding-left:8px;border-left:2px solid var(--dsw-alias-border-l2,rgba(0,0,0,.15));color:var(--dsw-alias-label-secondary,#666)}`,
      `.dsh-followup-hr{border:0;border-top:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.1));margin:8px 0}`,
      `.dsh-followup-table{width:100%;border-collapse:collapse;font-size:11.5px;margin:6px 0}`,
      `.dsh-followup-table th,.dsh-followup-table td{border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.1));padding:3px 6px;text-align:left}`,
      `.dsh-followup-a{color:var(--dsw-alias-brand-primary,#4d6bfe)}`,
      `.dsh-followup-clamp{max-height:180px;overflow:hidden}`,
      `.dsh-followup-clamp.dsh-followup-answer{max-height:220px}`,
      `.dsh-followup-turn{border-top:1px dashed var(--dsw-alias-border-l1,rgba(0,0,0,.1));padding-top:8px;display:flex;flex-direction:column;gap:4px}`,
      `.dsh-followup-wait{font-size:12px;color:var(--dsw-alias-label-tertiary,#999)}`,
      `.dsh-followup-answer--pending{color:var(--dsw-alias-label-tertiary,#999)}`,
      `.dsh-followup-q{box-sizing:border-box;width:100%;min-height:44px;max-height:160px;resize:vertical;padding:6px 8px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.12));background:var(--dsw-alias-bg-base,#fff);color:inherit;font:inherit;outline:none}`,
      `.dsh-followup-q:focus{border-color:var(--dsw-alias-brand-primary,#4d6bfe)}`,
      `.dsh-followup-row{display:flex;align-items:center;gap:8px}`,
      `.dsh-followup-send{border:0;border-radius:7px;padding:5px 12px;background:var(--dsw-alias-brand-primary,#4d6bfe);color:#fff;font:inherit;font-size:12px;cursor:pointer;appearance:none}`,
      `.dsh-followup-send:disabled{opacity:1;background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.16));color:var(--dsw-alias-label-tertiary,#8b8b8b);border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.22));cursor:default}`,
      `.dsh-followup-result{flex:1;min-width:0;color:var(--dsw-alias-label-secondary,#888);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}`,
      `.dsh-followup-panel-foot{padding:8px 12px;border-top:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.08));color:var(--dsw-alias-label-secondary,#888);font-size:12px;line-height:1.7;display:flex;flex-direction:column;gap:2px}`,
      `.dsh-followup-empty{color:var(--dsw-alias-label-tertiary,#999);font-size:12px;padding:12px 4px;line-height:1.7}`,
    ].join(`\n`)

    exports.name = NAME
    exports.inject = [`slots`, `timer`]

    /**
     * 安装插件：右键菜单、追问面板（原生右栏）、回答镜像与主对话隐藏。
     * @param ctx - 客户端根上下文。
     */
    exports.apply = function apply(ctx) {
      const slots = ctx.slots
      const layout = ctx.get(`layout`)
      const sidebarRight = ctx.get(`sidebarRight`)
      const doc = document
      const win = doc.defaultView

      ctx.effect(() => insertStyle(CSS), `${NAME}: styles`)

      const MAX_QUOTE = 3000
      const CLIP_QUOTE = 180
      const CLIP_ASKED = 200
      const CLIP_ANSWER = 360
      const menuSubscribers = new Set()
      const panelSubscribers = new Set()
      const markers = new Set()
      const capability = { setDraft: 0, useInput: 0, submit: 0, chat: 0 }
      let menu = null
      let pins = []
      let pinSeq = 0
      let askRequest = null
      const activeBySession = {}
      const hiddenTurns = []
      let hideFollowUpTurns = true
      let currentSessionId = null
      let chainMounted = false
      let overlayOpen = false
      let clearArmed = false
      /* 阅读位置守卫：追问期间主对话会跟随最新内容滚动，这里把阅读位置钉住。 */
      let transcriptScroller = null
      let readingGuard = null
      let readingTimerOff = null
      let readingUnpinned = false

      function notify(set) { set.forEach((fn) => { try { fn() } catch (error) { console.error(TAG, error) } }) }
      function subscribe(set, fn) { set.add(fn); return () => { set.delete(fn) } }
      function setMenu(next) { menu = next; notify(menuSubscribers) }
      function closeMenu() { if (menu !== null) setMenu(null) }
      function setPins(next) { pins = next; notify(panelSubscribers) }
      function patchPin(pinId, patch) {
        let hit = false
        const next = pins.map((pin) => {
          if (pin.id !== pinId) return pin
          hit = true
          return Object.assign({}, pin, patch)
        })
        if (hit === true) setPins(next)
        return hit
      }
      function patchThread(pinId, index, patch) {
        let hit = false
        const next = pins.map((pin) => {
          if (pin.id !== pinId) return pin
          hit = true
          const threads = pin.threads.map((entry, i) => (i === index ? Object.assign({}, entry, patch) : entry))
          return Object.assign({}, pin, { threads })
        })
        if (hit === true) setPins(next)
        return hit
      }
      function finishPin(pinId, result) { patchPin(pinId, { result }) }
      function claimAsk() {
        if (askRequest === null) return null
        const claimed = askRequest
        askRequest = null
        return claimed
      }
      function claimPins(sessionId) {
        if (typeof sessionId !== `string`) return
        let changed = false
        const next = pins.map((pin) => {
          if (pin.sessionId !== null) return pin
          changed = true
          return Object.assign({}, pin, { sessionId })
        })
        if (changed === true) setPins(next)
      }
      function pinsOf(sessionId) {
        if (typeof sessionId !== `string`) return pins.slice()
        return pins.filter((pin) => pin.sessionId === sessionId)
      }
      function openPanelFor() {
        overlayOpen = true
        notify(panelSubscribers)
        if (layout !== undefined && layout !== null && typeof layout.openRightbar === `function`) {
          try { layout.openRightbar(true, false) } catch (error) { console.error(TAG, error) }
        }
        if (sidebarRight !== undefined && sidebarRight !== null && typeof sidebarRight.openTab === `function`) {
          try { sidebarRight.openTab(`guide`) } catch (error) { console.error(TAG, error) }
        }
      }
      function measureTrack() {
        const el = doc.querySelector(`[data-slot="rightbar"]`)
        if (el !== null) {
          const rect = el.getBoundingClientRect()
          if (rect.width > 220) return Math.round(rect.width)
        }
        return 380
      }
      function clip(text, max) {
        if (typeof text !== `string`) return { text: ``, clipped: false }
        if (text.length <= max) return { text, clipped: false }
        return { text: text.slice(0, max).replace(/\s+$/, ``) + `…`, clipped: true }
      }

      /* ── 阅读位置守卫：追问期间不把主对话拽离用户正在读的位置 ──────────── */
      function stopReading() {
        readingGuard = null
        if (readingTimerOff !== null) {
          try { readingTimerOff() } catch (error) { console.error(TAG, error) }
          readingTimerOff = null
        }
      }
      function readingTick() {
        if (readingGuard === null) { stopReading(); return }
        readingGuard.elapsed += 200
        if (readingUnpinned === true || readingGuard.elapsed > 120000) { stopReading(); return }
        const el = readingGuard.el
        if (el.isConnected === false) { stopReading(); return }
        if (Math.abs(el.scrollTop - readingGuard.top) > 2) el.scrollTop = readingGuard.top
      }
      /** 发送追问前调用：钉住当前阅读位置；已经贴在底部时不干预（那是跟随阅读）。 */
      function pinReadingPosition() {
        const el = transcriptScroller
        if (el === null || el === undefined || el.isConnected === false) return
        const slack = el.scrollHeight - el.scrollTop - el.clientHeight
        if (slack < 40) { stopReading(); return }
        readingUnpinned = false
        readingGuard = { el, top: el.scrollTop, elapsed: 0 }
        if (readingTimerOff === null) readingTimerOff = ctx.interval(readingTick, 200)
      }

      /* ── 主对话中隐藏追问回合（只影响渲染，会话日志不变） ───────────────── */
      function applyHiddenTurns(sessionId) {
        for (const record of hiddenTurns) {
          try { if (typeof record.off === `function`) record.off() } catch (error) { console.error(TAG, error) }
          record.off = null
        }
        if (hideFollowUpTurns === false) return
        if (typeof sessionId !== `string`) return
        for (const record of hiddenTurns) {
          if (record.sessionId !== sessionId) continue
          try {
            record.off = insertStyle(`[data-chat-turn="${String(record.turn)}"]{display:none !important}`)
          } catch (error) { console.error(TAG, error) }
        }
      }
      function hideTurn(sessionId, turn) {
        for (const record of hiddenTurns) {
          if (record.sessionId === sessionId && record.turn === turn) return
        }
        hiddenTurns.push({ sessionId, turn, off: null })
        applyHiddenTurns(sessionId)
      }
      function restoreTurn(sessionId, turn) {
        for (let i = hiddenTurns.length - 1; i >= 0; i -= 1) {
          const record = hiddenTurns[i]
          if (sessionId !== null && record.sessionId !== sessionId) continue
          if (turn !== null && record.turn !== turn) continue
          try { if (typeof record.off === `function`) record.off() } catch (error) { console.error(TAG, error) }
          hiddenTurns.splice(i, 1)
        }
        applyHiddenTurns(currentSessionId)
      }

      /* ── 读取当前会话的回答文本（只取叶子字符串） ───────────────────────── */
      function navItems(snapshot) {
        if (snapshot === null || snapshot === undefined) return null
        const nav = snapshot.navigation
        if (nav === null || nav === undefined || typeof nav.items !== `function`) return null
        const items = nav.items()
        return items === null || items === undefined ? null : items
      }
      function navResponse(snapshot, index) {
        const items = navItems(snapshot)
        if (items === null || index < 0 || index >= items.length) return ``
        const item = items[index]
        if (item === null || item === undefined || typeof item.response !== `string`) return ``
        return item.response
      }
      function turnNumberAt(snapshot, index) {
        const items = navItems(snapshot)
        if (items === null || index < 0 || index >= items.length) return -1
        const item = items[index]
        if (item === null || item === undefined || typeof item.turn !== `number`) return -1
        return item.turn
      }
      function blocksText(blocks) {
        if (blocks === null || blocks === undefined) return ``
        let text = ``
        for (const block of blocks) {
          if (block === null || block === undefined) continue
          const kind = block.kind === undefined ? block.type : block.kind
          if (kind === `text` && typeof block.text === `string`) text += block.text
        }
        return text
      }
      /** 某回合的助手回答全文：turn-tail.closing.blocks（应用复制按钮同源）。 */
      function responseForTurn(snapshot, index) {
        if (snapshot === null || snapshot === undefined || index < 0) return ``
        const timeline = snapshot.timeline
        const locations = snapshot.locations
        const nodes = snapshot.nodes
        if (timeline === null || timeline === undefined || locations === null || locations === undefined || nodes === null || nodes === undefined) return ``
        const turns = timeline.turnOrder
        if (index >= turns.length) return ``
        const keys = locations.getTurn(turns[index])
        for (let j = keys.length - 1; j >= 0; j -= 1) {
          const node = nodes.get(keys[j])
          if (node === null || node === undefined || node.kind !== `turn-tail`) continue
          const data = node.data
          const closing = data === null || data === undefined ? null : data.closing
          if (closing === null || closing === undefined) continue
          const text = blocksText(closing.blocks)
          if (text.trim() !== ``) return text
        }
        const preview = navResponse(snapshot, index)
        return preview.trim() === `` ? `` : preview
      }

      /* ── 选区判定 ───────────────────────────────────────────────────────── */
      function normalizeSelection(raw) {
        const lines = String(raw).replace(/\r\n?/g, `\n`).split(`\n`)
        while (lines.length > 0 && lines[0].trim() === ``) lines.shift()
        while (lines.length > 0 && lines[lines.length - 1].trim() === ``) lines.pop()
        let text = lines.map((line) => line.replace(/[ \t]+$/, ``)).join(`\n`).trim()
        if (text.length > MAX_QUOTE) text = text.slice(0, MAX_QUOTE).trim() + ` …`
        return text
      }
      function isEditable(el) {
        let cur = el
        let depth = 0
        while (cur !== null && cur !== undefined && cur !== doc.body && depth < 40) {
          if (cur.nodeType === 1) {
            const tag = cur.tagName
            if (tag === `INPUT` || tag === `TEXTAREA` || tag === `SELECT`) return true
            if (cur.isContentEditable === true) return true
            if (typeof cur.getAttribute === `function` && cur.getAttribute(`contenteditable`) === `true`) return true
          }
          cur = cur.parentElement
          depth += 1
        }
        return false
      }
      function scrollerFor(el) {
        let cur = el
        let depth = 0
        while (cur !== null && cur !== undefined && cur !== doc.body && cur !== doc.documentElement && depth < 40) {
          const owner = cur.ownerDocument === null || cur.ownerDocument === undefined ? null : cur.ownerDocument
          const view = owner === null || owner.defaultView === undefined ? null : owner.defaultView
          if (view !== null && typeof view.getComputedStyle === `function`) {
            const overflowY = view.getComputedStyle(cur).overflowY
            if (overflowY === `auto` || overflowY === `scroll`) return cur
          }
          cur = cur.parentElement
          depth += 1
        }
        return null
      }
      function legacyTimelineHit(el) {
        if (markers.size === 0) return false
        const scroller = scrollerFor(el)
        if (scroller === null) return false
        let inside = false
        markers.forEach((marker) => { if (inside === false && scroller.contains(marker)) inside = true })
        return inside
      }
      /** 归属判断：优先用框架的会话正文标记，取不到时降为旧的滚动容器启发式。 */
      function inConversationBody(el) {
        let region = null
        try {
          if (typeof el.closest === `function`) region = el.closest(`[data-slot="conversation.session"]`)
        } catch (error) { region = null }
        if (region !== null && region !== undefined) return { ok: true, how: `region` }
        return { ok: legacyTimelineHit(el), how: `heuristic` }
      }
      function readSelection() {
        const selection = typeof doc.getSelection === `function` ? doc.getSelection() : null
        if (selection === null || selection === undefined) return { text: ``, reason: `浏览器不支持选区读取` }
        if (selection.rangeCount === 0 || selection.isCollapsed === true) return { text: ``, reason: `没有选中文字` }
        const text = normalizeSelection(selection.toString())
        if (text === ``) return { text: ``, reason: `选中内容为空` }
        const anchor = selection.anchorNode
        if (anchor === null || anchor === undefined) return { text: ``, reason: `取不到选区节点` }
        const anchorEl = anchor.nodeType === 1 ? anchor : anchor.parentElement
        if (anchorEl === null || anchorEl === undefined) return { text: ``, reason: `取不到选区元素` }
        if (isEditable(anchorEl)) return { text: ``, reason: `选区在可编辑区域内` }
        if (markers.size === 0) return { text: ``, reason: `还没有已完成的回答锚点` }
        const hit = inConversationBody(anchorEl)
        if (hit.ok === false) return { text: ``, reason: `选区不在会话正文内` }
        let rect = null
        try { rect = selection.getRangeAt(0).getBoundingClientRect() } catch (error) { rect = null }
        return {
          text,
          how: hit.how,
          rect: rect === null ? null : { left: rect.left, bottom: rect.bottom },
        }
      }
      function onContextMenu(event) {
        const found = readSelection()
        if (found.text === ``) {
          if (menu !== null) closeMenu()
          return
        }
        /* 抢在应用自带右键插件（document 捕获）之前接管：window 捕获 + 阻止传播。 */
        event.preventDefault()
        event.stopPropagation()
        const fromMouse = event.clientX > 0 || event.clientY > 0
        const rect = found.rect
        setMenu({
          x: fromMouse ? event.clientX : (rect === null ? 96 : rect.left),
          y: fromMouse ? event.clientY : (rect === null ? 96 : rect.bottom + 6),
          text: found.text,
        })
      }
      ctx.effect(() => {
        win.addEventListener(`contextmenu`, onContextMenu, true)
        return () => { win.removeEventListener(`contextmenu`, onContextMenu, true) }
      }, `${NAME}: context menu`)

      /* 用户自己滚动或按键时立刻放开守卫，绝不抢用户对滚动的控制权。 */
      ctx.effect(() => {
        const unpin = () => { readingUnpinned = true }
        const onKeyDown = (event) => {
          const keys = [`PageUp`, `PageDown`, `ArrowUp`, `ArrowDown`, `Home`, `End`, ` `]
          if (keys.indexOf(event.key) !== -1) unpin()
        }
        const onPointerDown = (event) => {
          const el = transcriptScroller
          const target = event.target
          if (el !== null && el !== undefined && target !== null && target !== undefined && el.contains(target) === true) unpin()
        }
        win.addEventListener(`wheel`, unpin, true)
        win.addEventListener(`touchstart`, unpin, true)
        win.addEventListener(`keydown`, onKeyDown, true)
        doc.addEventListener(`pointerdown`, onPointerDown, true)
        return () => {
          win.removeEventListener(`wheel`, unpin, true)
          win.removeEventListener(`touchstart`, unpin, true)
          win.removeEventListener(`keydown`, onKeyDown, true)
          doc.removeEventListener(`pointerdown`, onPointerDown, true)
          stopReading()
        }
      }, `${NAME}: reading guard`)

      /* ── 写入主会话（已验证可行的通道） ─────────────────────────────────── */
      function findComposerInput(anchor) {
        if (anchor === null || anchor === undefined) return null
        let el = anchor.parentElement
        let depth = 0
        while (el !== null && el !== undefined && el !== doc.body && el !== doc.documentElement && depth < 12) {
          if (typeof el.querySelector === `function`) {
            let found = el.querySelector(`[data-composer-input]`)
            if (found === null) found = el.querySelector(`div[contenteditable="true"]`)
            if (found !== null) return found
          }
          el = el.parentElement
          depth += 1
        }
        return null
      }
      function quoteBlock(text) {
        return text.split(`\n`).map((line) => (line === `` ? `>` : `> ` + line)).join(`\n`)
      }
      function pasteIntoComposer(hostEl, text) {
        const input = findComposerInput(hostEl)
        if (input === null) return `找不到输入框`
        try { input.focus() } catch (error) { console.error(TAG, error) }
        const before = typeof input.textContent === `string` ? input.textContent : ``
        let accepted = false
        try {
          if (typeof DataTransfer === `function` && typeof ClipboardEvent === `function`) {
            const transfer = new DataTransfer()
            transfer.setData(`text/plain`, text)
            const event = new ClipboardEvent(`paste`, { bubbles: true, cancelable: true, clipboardData: transfer })
            input.dispatchEvent(event)
            accepted = event.defaultPrevented === true
          }
        } catch (error) { console.error(TAG, error) }
        if (accepted === true) return `合成 paste 成功`
        const after = typeof input.textContent === `string` ? input.textContent : ``
        if (after !== before) return `合成 paste 成功（内容已变）`
        try {
          if (typeof doc.execCommand === `function` && doc.execCommand(`insertText`, false, text) === true) return `execCommand 成功`
        } catch (error) { console.error(TAG, error) }
        return `写入失败（输入框未接管）`
      }

      /* ── hooks ─────────────────────────────────────────────────────────── */
      function useVersion(set) {
        const tuple = React.useState(0)
        React.useEffect(() => subscribe(set, () => tuple[1]((n) => n + 1)), [])
      }

      function useAskBridge(props) {
        useVersion(panelSubscribers)
        const sessionId = typeof props.sessionId === `string` ? props.sessionId : null
        const pending = askRequest
        const actions = props.inputActions
        const hasSetDraft = actions !== null && actions !== undefined && typeof actions.setDraft === `function`
        const hasSubmit = actions !== null && actions !== undefined && typeof actions.submit === `function`
        const readDraft = typeof props.useInput === `function` ? props.useInput : null
        const draft = readDraft === null ? null : readDraft((input) => (input === null || input === undefined || typeof input.draft !== `string` ? `` : input.draft))
        const draftRef = React.useRef(draft)
        draftRef.current = draft
        const hostRef = React.useRef(null)
        React.useEffect(() => {
          if (sessionId === null) return undefined
          if (currentSessionId !== sessionId) {
            currentSessionId = sessionId
            applyHiddenTurns(sessionId)
          }
          claimPins(sessionId)
          notify(panelSubscribers)
          return undefined
        }, [sessionId])
        React.useEffect(() => {
          if (hasSetDraft === true) capability.setDraft += 1
          if (hasSubmit === true) capability.submit += 1
          if (readDraft !== null) capability.useInput += 1
          return () => {
            if (hasSetDraft === true) capability.setDraft -= 1
            if (hasSubmit === true) capability.submit -= 1
            if (readDraft !== null) capability.useInput -= 1
          }
        }, [hasSetDraft, hasSubmit, readDraft])
        React.useEffect(() => {
          if (pending === null || sessionId === null) return undefined
          const claimed = claimAsk()
          if (claimed === null) return undefined
          const full = quoteBlock(claimed.text) + `\n\n` + claimed.question
          const current = typeof draftRef.current === `string` ? draftRef.current : null
          if (hasSetDraft === true && current !== null) {
            if (current.trim() === ``) {
              try { actions.setDraft(full) } catch (error) { console.error(TAG, error) }
              if (hasSubmit === true) {
                pinReadingPosition()
                try { actions.submit(); finishPin(claimed.pinId, `已发送，等待回答…`) } catch (error) { console.error(TAG, error); finishPin(claimed.pinId, `发送失败：` + String(error)) }
              } else {
                finishPin(claimed.pinId, `已填入输入框（未找到发送能力）`)
              }
            } else {
              try { actions.setDraft(current.replace(/\s+$/, ``) + `\n\n` + full) } catch (error) { console.error(TAG, error) }
              finishPin(claimed.pinId, `输入框已有内容：已追加到草稿，未自动发送`)
            }
            return undefined
          }
          finishPin(claimed.pinId, pasteIntoComposer(hostRef.current, full))
          return undefined
        }, [pending, actions, hasSetDraft, hasSubmit, sessionId])
        return hostRef
      }

      function useAnswerMirror(props) {
        const useChat = typeof props.useChat === `function` ? props.useChat : null
        const sessionId = typeof props.sessionId === `string` ? props.sessionId : null
        const turnRef = React.useRef(-1)
        const pending = askRequest
        const turnCount = useChat === null ? -1 : useChat((snapshot) => {
          const items = navItems(snapshot)
          return items === null ? -1 : items.length
        })
        const answer = useChat === null ? `` : useChat((snapshot) => responseForTurn(snapshot, turnRef.current))
        const turnNo = useChat === null ? -1 : useChat((snapshot) => turnNumberAt(snapshot, turnRef.current))
        React.useEffect(() => {
          if (useChat !== null) { capability.chat += 1; notify(panelSubscribers) }
          return () => { if (useChat !== null) capability.chat -= 1 }
        }, [useChat])
        React.useEffect(() => {
          if (pending === null) return undefined
          if (turnCount >= 0) turnRef.current = turnCount
          return undefined
        }, [pending, turnCount])
        React.useEffect(() => {
          if (sessionId === null || turnNo < 0) return
          hideTurn(sessionId, turnNo)
        }, [sessionId, turnNo])
        React.useEffect(() => {
          /* 只把"有实际内容"的回答镜像进卡片：空白字符串会让灰块看起来是空的。 */
          if (answer.trim() === `` || sessionId === null) return
          const active = activeBySession[sessionId]
          if (active === undefined) return
          const pin = pins.find((entry) => entry.id === active.pinId)
          if (pin === undefined) return
          const entry = pin.threads[active.index]
          if (entry === undefined || entry.answer === answer) return
          patchThread(active.pinId, active.index, { answer })
          patchPin(active.pinId, { result: `已回答` })
        }, [answer])
      }

      /* ── 组件 ──────────────────────────────────────────────────────────── */
      function FollowUpAnchor(props) {
        const hostRef = useAskBridge(props)
        React.useEffect(() => {
          const el = hostRef.current
          if (el === null) return undefined
          markers.add(el)
          /* 这段隐藏锚点就住在对话流里，用它定位会话的滚动容器。 */
          const scroller = scrollerFor(el)
          if (scroller !== null) transcriptScroller = scroller
          return () => { markers.delete(el) }
        }, [])
        return React.createElement(`span`, { ref: hostRef, hidden: true, 'aria-hidden': `true` })
      }

      function FollowUpBridge(props) {
        const hostRef = useAskBridge(props)
        useAnswerMirror(props)
        return React.createElement(`span`, { ref: hostRef, hidden: true, 'aria-hidden': `true` })
      }

      function FollowUpToggle(props) {
        useVersion(panelSubscribers)
        const sessionId = typeof props.sessionId === `string` ? props.sessionId : null
        const mine = pinsOf(sessionId)
        return React.createElement(`button`, {
          type: `button`,
          className: `dsh-followup-toggle`,
          'data-on': mine.length > 0 ? `true` : `false`,
          title: `打开本会话的追问面板`,
          onClick: () => { openPanelFor() },
        }, `追问 ` + String(mine.length))
      }

      function FollowUpMenu() {
        useVersion(menuSubscribers)
        const state = menu
        const open = state !== null
        const ref = React.useRef(null)
        React.useEffect(() => {
          if (open === false) return undefined
          const onMouseDown = (event) => {
            const el = ref.current
            const target = event.target
            if (el !== null && target !== null && target !== undefined && el.contains(target) === true) return
            closeMenu()
          }
          const onKeyDown = (event) => { if (event.key === `Escape`) closeMenu() }
          const onDismiss = () => closeMenu()
          doc.addEventListener(`mousedown`, onMouseDown, true)
          doc.addEventListener(`keydown`, onKeyDown, true)
          doc.addEventListener(`scroll`, onDismiss, true)
          win.addEventListener(`resize`, onDismiss)
          return () => {
            doc.removeEventListener(`mousedown`, onMouseDown, true)
            doc.removeEventListener(`keydown`, onKeyDown, true)
            doc.removeEventListener(`scroll`, onDismiss, true)
            win.removeEventListener(`resize`, onDismiss)
          }
        }, [open])
        if (open === false) return null
        const maxX = Math.max(8, (win.innerWidth || 0) - 272)
        const maxY = Math.max(8, (win.innerHeight || 0) - 124)
        const left = Math.max(8, Math.min(state.x, maxX))
        const top = Math.max(8, Math.min(state.y, maxY))
        const preview = clip(state.text.replace(/\s+/g, ` `), 40).text
        const onFollowUp = () => {
          const text = state.text
          closeMenu()
          pinSeq += 1
          const pin = { id: `pin-` + String(pinSeq), index: pinSeq, sessionId: currentSessionId, text, result: `等待提问`, threads: [] }
          setPins([pin].concat(pins))
          openPanelFor()
        }
        const onCopy = () => {
          const text = state.text
          closeMenu()
          try {
            const nav = win.navigator
            if (nav !== null && nav !== undefined && nav.clipboard !== null && nav.clipboard !== undefined && typeof nav.clipboard.writeText === `function`) {
              const done = nav.clipboard.writeText(text)
              if (done !== null && done !== undefined && typeof done.catch === `function`) done.catch(() => {})
            }
          } catch (error) { console.error(TAG, error) }
        }
        return React.createElement(`div`, {
          ref,
          className: `dsh-followup-menu`,
          role: `menu`,
          style: { left: left + `px`, top: top + `px` },
          onContextMenu: (event) => { event.preventDefault() },
        },
          React.createElement(`div`, { className: `dsh-followup-preview` }, `「` + preview + `」`),
          React.createElement(`button`, { type: `button`, role: `menuitem`, className: `dsh-followup-item`, 'data-primary': `true`, onClick: onFollowUp }, `追问（右侧面板）`),
          React.createElement(`button`, { type: `button`, role: `menuitem`, className: `dsh-followup-item`, onClick: onCopy }, `复制选中内容`),
        )
      }

      function PanelBody(props) {
        useVersion(panelSubscribers)
        const mode = props.mode
        const sessionId = typeof props.sessionId === `string` ? props.sessionId : currentSessionId
        const draftsTuple = React.useState({})
        const drafts = draftsTuple[0]
        const setDrafts = draftsTuple[1]
        const expandedTuple = React.useState({})
        const expanded = expandedTuple[0]
        const setExpanded = expandedTuple[1]
        const widthTuple = React.useState(measureTrack)
        const width = widthTuple[0]
        const setWidth = widthTuple[1]
        const mine = pinsOf(sessionId)

        React.useEffect(() => {
          if (mode !== `overlay` || overlayOpen === false) return undefined
          const remeasure = () => setWidth(measureTrack())
          remeasure()
          const t1 = ctx.timeout(remeasure, 120)
          const t2 = ctx.timeout(remeasure, 500)
          win.addEventListener(`resize`, remeasure)
          return () => {
            t1()
            t2()
            win.removeEventListener(`resize`, remeasure)
          }
        }, [mode, overlayOpen, mine.length])
        React.useEffect(() => {
          if (clearArmed === false) return undefined
          return ctx.timeout(() => { clearArmed = false; notify(panelSubscribers) }, 3000)
        }, [clearArmed])

        const setDraft = (id, value) => {
          const next = Object.assign({}, drafts)
          next[id] = value
          setDrafts(next)
        }
        const toggle = (key) => {
          const next = Object.assign({}, expanded)
          next[key] = next[key] !== true
          setExpanded(next)
        }
        /** 行内状态：只在需要提示时出现（正常的"已回答"不占位、不飘在按钮旁）。 */
        const statusOf = (pin) => {
          const text = typeof pin.result === `string` ? pin.result : ``
          if (text === `已回答` || text === `等待提问` || text === `正在发送…` || text === `已发送，等待回答…`) return ``
          return text
        }
        /**
         * 一块内容：用插件自带的 Markdown 渲染，
         * 过长时按「高度」折叠而不是截断文本，避免把代码围栏截断成半截。
         */
        const block = (key, text, max, cls) => {
          const isOpen = expanded[key] === true
          const long = typeof text === `string` && text.length > max
          const body = React.createElement(`div`, { className: `dsh-followup-md` }, renderMarkdown(text, key))
          const children = [React.createElement(`div`, {
            className: long === true && isOpen === false ? cls + ` dsh-followup-clamp` : cls,
            key: `body`,
          }, body)]
          if (long === true) {
            children.push(React.createElement(`button`, {
              type: `button`,
              key: `more`,
              className: `dsh-followup-mini dsh-followup-link`,
              onClick: () => toggle(key),
            }, isOpen ? `收起` : `展开全文（` + String(text.length) + ` 字）`))
          }
          return React.createElement(`div`, { className: `dsh-followup-block`, key }, children)
        }
        const send = (pin) => {
          const raw = drafts[pin.id]
          const question = typeof raw === `string` ? raw.trim() : ``
          if (question === ``) return
          const index = pin.threads.length
          askRequest = { pinId: pin.id, text: pin.text, question }
          if (typeof pin.sessionId === `string`) activeBySession[pin.sessionId] = { pinId: pin.id, index }
          setDraft(pin.id, ``)
          patchPin(pin.id, { threads: pin.threads.concat([{ question, answer: `` }]), result: `正在发送…` })
        }
        const cards = mine.map((pin) => {
          const value = typeof drafts[pin.id] === `string` ? drafts[pin.id] : ``
          const children = [
            React.createElement(`div`, { className: `dsh-followup-card-head`, key: `head` },
              React.createElement(`span`, { className: `dsh-followup-badge` }, `#` + String(pin.index)),
              React.createElement(`span`, null, `引用 ` + String(pin.text.length) + ` 字`),
              React.createElement(`span`, null, `· ` + String(pin.threads.length) + ` 轮追问`),
              React.createElement(`button`, {
                type: `button`,
                className: `dsh-followup-mini`,
                onClick: () => {
                  setPins(pins.filter((entry) => entry.id !== pin.id))
                  restoreTurn(sessionId, null)
                },
              }, `删除`),
            ),
          ]
          children.push(block(`quote:` + pin.id, pin.text, CLIP_QUOTE, `dsh-followup-quote`))
          for (let i = 0; i < pin.threads.length; i += 1) {
            const entry = pin.threads[i]
            const rows = [
              React.createElement(`div`, { className: `dsh-followup-label`, key: `lq` }, `我的追问 ` + String(i + 1)),
              block(`q:` + pin.id + `:` + String(i), entry.question, CLIP_ASKED, `dsh-followup-asked`),
              React.createElement(`div`, { className: `dsh-followup-label`, key: `la` }, `回答 ` + String(i + 1)),
            ]
            const shown = typeof entry.answer === `string` ? entry.answer.trim() : ``
            if (shown !== ``) {
              rows.push(block(`a:` + pin.id + `:` + String(i), entry.answer, CLIP_ANSWER, `dsh-followup-answer`))
            } else {
              /* 没有回答时，灰块里放状态文字，绝不留下一个空白灰块。 */
              const isLatest = i === pin.threads.length - 1
              const note = isLatest === true ? statusOf(pin) : ``
              rows.push(React.createElement(`div`, {
                className: `dsh-followup-answer dsh-followup-answer--pending`,
                key: `w`,
              }, note !== `` ? note : `等回答中…`))
            }
            children.push(React.createElement(`div`, { className: `dsh-followup-turn`, key: `turn-` + String(i) }, rows))
          }
          children.push(React.createElement(`textarea`, {
            className: `dsh-followup-q`,
            key: `draft`,
            value,
            placeholder: pin.threads.length === 0 ? `针对这段内容追问…（Enter 发送）` : `继续追问…（Enter 发送，Shift+Enter 换行）`,
            onChange: (event) => setDraft(pin.id, event.target.value),
            onKeyDown: (event) => {
              if (event.key !== `Enter` || event.shiftKey === true) return
              event.preventDefault()
              send(pin)
            },
          }))
          children.push(React.createElement(`div`, { className: `dsh-followup-row`, key: `row` },
            React.createElement(`button`, {
              type: `button`,
              className: `dsh-followup-send`,
              disabled: value.trim() === ``,
              onClick: () => send(pin),
            }, pin.threads.length === 0 ? `发送追问` : `继续追问`),
            React.createElement(`div`, { className: `dsh-followup-result`, key: `res` }, statusOf(pin)),
          ))
          return React.createElement(`div`, { className: `dsh-followup-card`, key: pin.id }, children)
        })
        const empty = React.createElement(`div`, { className: `dsh-followup-empty` },
          `还没有追问卡片。在这个会话的回答里选中文字（正文、代码块、表格都可以）→ 右键 → 「追问（右侧面板）」。`,
        )
        const hiddenCount = hiddenTurns.filter((record) => record.sessionId === sessionId).length

        return React.createElement(`div`, {
          className: mode === `tab` ? `dsh-followup-panel dsh-followup-panel--inline` : `dsh-followup-panel`,
          style: mode === `tab` ? null : { width: String(width) + `px` },
        },
          React.createElement(`div`, { className: `dsh-followup-panel-head` },
            React.createElement(`div`, { className: `dsh-followup-panel-title` }, `追问面板`),
            React.createElement(`div`, { className: `dsh-followup-panel-count` }, String(mine.length) + ` 条`),
            mine.length > 0 ? React.createElement(`button`, {
              type: `button`,
              className: `dsh-followup-mini`,
              onClick: () => {
                if (clearArmed === false) { clearArmed = true; notify(panelSubscribers); return }
                clearArmed = false
                setPins(pins.filter((pin) => pin.sessionId !== sessionId))
                setDrafts({})
                restoreTurn(sessionId, null)
              },
            }, clearArmed ? `再点一次确认清空` : `清空`) : null,
            mode === `overlay` ? React.createElement(`button`, {
              type: `button`,
              className: `dsh-followup-mini`,
              onClick: () => { overlayOpen = false; notify(panelSubscribers) },
            }, `收起`) : null,
          ),
          React.createElement(`div`, { className: `dsh-followup-panel-body` }, mine.length === 0 ? empty : React.createElement(PanelBoundary, null, cards)),
          React.createElement(`div`, { className: `dsh-followup-panel-foot` },
            React.createElement(`div`, null, `本会话独立面板 · 回答全文镜像 · 长文默认省略`),
            React.createElement(`button`, {
              type: `button`,
              className: `dsh-followup-mini`,
              onClick: () => {
                hideFollowUpTurns = hideFollowUpTurns === false
                applyHiddenTurns(sessionId)
                notify(panelSubscribers)
              },
            }, (hideFollowUpTurns ? `主对话隐藏追问：开` : `主对话隐藏追问：关`) + (hiddenCount > 0 ? `（` + String(hiddenCount) + ` 轮）` : ``)),
          ),
        )
      }

      function FollowUpTabPanel(props) {
        React.useEffect(() => {
          chainMounted = true
          notify(panelSubscribers)
          return undefined
        }, [])
        return React.createElement(PanelBody, { mode: `tab`, sessionId: props.sessionId })
      }

      function FollowUpOverlayPanel() {
        useVersion(panelSubscribers)
        if (chainMounted === true || overlayOpen === false) return null
        return React.createElement(PanelBody, { mode: `overlay`, sessionId: null })
      }

      slots.inject(`conversation.chat.assistant-actions`, () => slots.register(
        { name: `conversation.chat.assistant-actions`, id: `followup-anchor`, order: 50 },
        FollowUpAnchor,
      ))
      slots.inject(`conversation.input.overlay`, () => slots.register(
        { name: `conversation.input.overlay`, id: `followup-bridge`, order: 50 },
        FollowUpBridge,
      ))
      slots.inject(`conversation.session.header.actions`, () => slots.register(
        { name: `conversation.session.header.actions`, id: `followup-toggle`, order: 60, label: `追问面板` },
        FollowUpToggle,
      ))
      slots.inject(`sidebar.right.tab.guide`, () => slots.register(
        { name: `sidebar.right.tab.guide`, select: () => ({ followUp: `panel` }) },
        FollowUpTabPanel,
      ))
      slots.inject(`shell.overlay`, () => slots.register(
        { name: `shell.overlay`, id: `followup-menu`, order: 80 },
        FollowUpMenu,
      ))
      slots.inject(`shell.overlay`, () => slots.register(
        { name: `shell.overlay`, id: `followup-panel-fallback`, order: 90 },
        FollowUpOverlayPanel,
      ))

      console.log(TAG + `已就绪：选中回答文字后右键 → 追问`)
    }

    return module.exports
  },
})
