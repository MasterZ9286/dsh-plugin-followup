/**
 * dsh-plugin-followup — 宿主半区（占位）
 *
 * 本插件是纯客户端插件：追问的投递走会话自身的输入通道，
 * 读取回答走会话快照，因此宿主侧不需要注册任何服务或路由。
 * 这里保留一个空的 apply，使包在两侧都存在入口，便于统一安装。
 */

export const name = `dsh-plugin-followup`

export function apply() {
  // 无需宿主侧逻辑。
}
