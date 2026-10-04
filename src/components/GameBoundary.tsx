import { Component, type ReactNode } from "react";
/** A single failed module must not blank the game hall or erase earned progress. */
export class GameBoundary extends Component<
  { children: ReactNode; onBack: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <section className="module-error" role="alert">
          <h2>这个游戏暂时遇到了问题。</h2>
          <p>
            已经完成的关卡仍保存在当前浏览器。可以返回大厅，或重新加载后再试。
          </p>
          <div className="row">
            <button onClick={this.props.onBack}>返回游戏大厅</button>
            <button
              className="primary"
              onClick={() => window.location.reload()}
            >
              重新加载
            </button>
          </div>
        </section>
      );
    return this.props.children;
  }
}
