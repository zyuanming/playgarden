// SPDX-License-Identifier: GPL-3.0-only
import { correspondingSourceUrl, PROJECT_LICENSE } from "../lib/license";
import "./licenseLinks.css";
export function LicenseLinks() {
  return (
    <div className="project-license" aria-label="项目许可与完整源码">
      <p>
        © 2026 YuanMing（自有贡献）。可依 GPL-3.0-only
        再分发；本程序不提供担保。
      </p>
      <div>
        <a href="./playgarden-COPYING.txt" target="_blank" rel="noreferrer">
          项目许可 · {PROJECT_LICENSE}
        </a>
        <a href={correspondingSourceUrl()} target="_blank" rel="noreferrer">
          本版本完整源码与构建说明
        </a>
      </div>
      <p>
        第三方组件保留原许可与署名。
        <a href="./THIRD_PARTY_NOTICES.txt" target="_blank" rel="noreferrer">
          查看第三方声明
        </a>
      </p>
    </div>
  );
}
