#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────
# 大龙虾 (ClawPro) — Linux CLI 安装配置脚本
# 适用于无 GUI 的 Linux 环境（服务器 / WSL / SSH）
# 功能：安装 OpenClaw → 配置 API 中转 → 可选配聊天平台 → 注册后台服务
# ─────────────────────────────────────────────────

ONEAPI_DEFAULT="https://oneapi.gs/v1"
OPENCLAW_CONFIG_DIR="$HOME/.openclaw"
OPENCLAW_CONFIG="$OPENCLAW_CONFIG_DIR/openclaw.json"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

info()  { echo -e "${CYAN}[大龙虾]${NC} $1"; }
ok()    { echo -e "${GREEN}[  ✓  ]${NC} $1"; }
warn()  { echo -e "${YELLOW}[ 注意 ]${NC} $1"; }
fail()  { echo -e "${RED}[ 错误 ]${NC} $1"; exit 1; }

ask() {
    local prompt="$1" default="${2:-}" reply
    if [ -n "$default" ]; then
        read -rp "$(echo -e "${BOLD}$prompt${NC} [$default]: ")" reply
        echo "${reply:-$default}"
    else
        read -rp "$(echo -e "${BOLD}$prompt${NC}: ")" reply
        echo "$reply"
    fi
}

ask_yn() {
    local prompt="$1" default="${2:-y}" reply
    read -rp "$(echo -e "${BOLD}$prompt${NC} [${default}]: ")" reply
    reply="${reply:-$default}"
    [[ "$reply" =~ ^[Yy] ]]
}

# ──── 检测环境 ────

check_node() {
    if command -v node &>/dev/null; then
        local ver
        ver=$(node -v | sed 's/v//')
        local major=${ver%%.*}
        if [ "$major" -ge 18 ]; then
            ok "Node.js $ver 已安装"
            return 0
        else
            warn "Node.js 版本 $ver 过低，需要 18+"
            return 1
        fi
    else
        warn "未检测到 Node.js"
        return 1
    fi
}

install_node() {
    info "正在安装 Node.js..."
    if command -v apt-get &>/dev/null; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
    elif command -v dnf &>/dev/null; then
        curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
        sudo dnf install -y nodejs
    elif command -v pacman &>/dev/null; then
        sudo pacman -S --noconfirm nodejs npm
    elif command -v apk &>/dev/null; then
        sudo apk add nodejs npm
    else
        fail "无法自动安装 Node.js，请手动安装 Node.js 18+ 后重试"
    fi
    ok "Node.js $(node -v) 安装完成"
}

check_openclaw() {
    if command -v openclaw &>/dev/null; then
        local ver
        ver=$(openclaw --version 2>/dev/null || echo "unknown")
        ok "OpenClaw 已安装: $ver"
        return 0
    fi
    return 1
}

# ──── 安装 OpenClaw ────

install_openclaw() {
    info "正在通过 npm 安装 OpenClaw..."
    npm install -g openclaw 2>&1 | tail -3
    if command -v openclaw &>/dev/null; then
        ok "OpenClaw $(openclaw --version 2>/dev/null || echo '') 安装成功"
    else
        fail "OpenClaw 安装失败，请检查 npm 权限或使用 sudo"
    fi
}

# ──── 配置 API 中转 ────

configure_api() {
    echo ""
    info "配置 API 中转服务"
    echo -e "  推荐使用 ${CYAN}https://oneapi.gs${NC} 获取 API Key"
    echo ""

    local base_url api_key provider_name

    base_url=$(ask "API 地址" "$ONEAPI_DEFAULT")
    api_key=$(ask "API Key (sk-...)")

    if [ -z "$api_key" ]; then
        warn "未输入 API Key，跳过配置（稍后可在大龙虾桌面版或直接编辑 $OPENCLAW_CONFIG 配置）"
        return
    fi

    provider_name=$(ask "供应商名称" "oneapi")

    openclaw config set "models.providers.${provider_name}.baseUrl" "$base_url" 2>/dev/null || true
    openclaw config set "models.providers.${provider_name}.apiKey" "$api_key" 2>/dev/null || true
    openclaw config set "models.providers.${provider_name}.api" "openai-completions" 2>/dev/null || true

    ok "API 中转配置完成 → $provider_name ($base_url)"

    echo ""
    info "选择默认模型"
    echo "  常用模型："
    echo "    1) anthropic/claude-sonnet-4-20250514"
    echo "    2) openai/gpt-4o"
    echo "    3) openai/gpt-4.1"
    echo "    4) google/gemini-2.5-pro"
    echo "    5) deepseek/deepseek-chat"
    echo "    6) 自定义"

    local choice model
    choice=$(ask "选择 [1-6]" "5")
    case "$choice" in
        1) model="anthropic/claude-sonnet-4-20250514" ;;
        2) model="openai/gpt-4o" ;;
        3) model="openai/gpt-4.1" ;;
        4) model="google/gemini-2.5-pro" ;;
        5) model="deepseek/deepseek-chat" ;;
        6) model=$(ask "输入模型 ID") ;;
        *) model="deepseek/deepseek-chat" ;;
    esac

    openclaw config set "agents.defaults.model.primary" "$model" 2>/dev/null || true
    ok "默认模型: $model"
}

# ──── 配置聊天平台 ────

configure_channels() {
    echo ""
    if ! ask_yn "是否配置聊天平台（QQ/Telegram/飞书等）？" "n"; then
        info "跳过聊天平台配置（稍后可在大龙虾桌面版配置）"
        return
    fi

    echo ""
    echo "  可用平台："
    echo "    1) Telegram — 需要 Bot Token"
    echo "    2) QQ       — 需要 App ID + App Secret"
    echo "    3) 飞书      — 需要 App ID + App Secret"
    echo "    4) Discord  — 需要 Bot Token"
    echo "    5) Slack    — 需要 Bot Token + App Token"
    echo ""

    local platforms
    platforms=$(ask "输入要配置的编号，用逗号分隔（如 1,2）" "")

    if [ -z "$platforms" ]; then
        return
    fi

    IFS=',' read -ra nums <<< "$platforms"
    for num in "${nums[@]}"; do
        num=$(echo "$num" | tr -d ' ')
        case "$num" in
            1)
                echo ""
                info "配置 Telegram"
                local tg_token
                tg_token=$(ask "Bot Token（从 @BotFather 获取）")
                if [ -n "$tg_token" ]; then
                    openclaw config set "channels.telegram.enabled" "true" 2>/dev/null || true
                    openclaw config set "channels.telegram.token" "$tg_token" 2>/dev/null || true
                    ok "Telegram 已配置"
                fi
                ;;
            2)
                echo ""
                info "配置 QQ"
                local qq_appid qq_secret
                qq_appid=$(ask "App ID")
                qq_secret=$(ask "App Secret")
                if [ -n "$qq_appid" ] && [ -n "$qq_secret" ]; then
                    openclaw config set "channels.qq.enabled" "true" 2>/dev/null || true
                    openclaw config set "channels.qq.appId" "$qq_appid" 2>/dev/null || true
                    openclaw config set "channels.qq.secret" "$qq_secret" 2>/dev/null || true
                    ok "QQ 已配置"
                fi
                ;;
            3)
                echo ""
                info "配置飞书"
                local fs_appid fs_secret
                fs_appid=$(ask "App ID")
                fs_secret=$(ask "App Secret")
                if [ -n "$fs_appid" ] && [ -n "$fs_secret" ]; then
                    openclaw config set "channels.feishu.enabled" "true" 2>/dev/null || true
                    openclaw config set "channels.feishu.appId" "$fs_appid" 2>/dev/null || true
                    openclaw config set "channels.feishu.appSecret" "$fs_secret" 2>/dev/null || true
                    ok "飞书已配置"
                fi
                ;;
            4)
                echo ""
                info "配置 Discord"
                local dc_token
                dc_token=$(ask "Bot Token")
                if [ -n "$dc_token" ]; then
                    openclaw config set "channels.discord.enabled" "true" 2>/dev/null || true
                    openclaw config set "channels.discord.token" "$dc_token" 2>/dev/null || true
                    ok "Discord 已配置"
                fi
                ;;
            5)
                echo ""
                info "配置 Slack"
                local sl_bot sl_app
                sl_bot=$(ask "Bot Token (xoxb-...)")
                sl_app=$(ask "App Token (xapp-...)")
                if [ -n "$sl_bot" ] && [ -n "$sl_app" ]; then
                    openclaw config set "channels.slack.enabled" "true" 2>/dev/null || true
                    openclaw config set "channels.slack.botToken" "$sl_bot" 2>/dev/null || true
                    openclaw config set "channels.slack.appToken" "$sl_app" 2>/dev/null || true
                    ok "Slack 已配置"
                fi
                ;;
            *)
                warn "未知选项: $num，跳过"
                ;;
        esac
    done
}

# ──── 注册 systemd 后台服务 ────

setup_service() {
    echo ""
    if ! ask_yn "是否将 OpenClaw Gateway 注册为后台服务（开机自启）？" "y"; then
        return
    fi

    local service_dir="$HOME/.config/systemd/user"
    mkdir -p "$service_dir"

    local openclaw_path
    openclaw_path=$(command -v openclaw)

    cat > "$service_dir/openclaw-gateway.service" << EOF
[Unit]
Description=OpenClaw Gateway (大龙虾)
After=network.target

[Service]
Type=simple
ExecStart=$openclaw_path gateway run --allow-unconfigured
Restart=always
RestartSec=10
Environment=HOME=$HOME

[Install]
WantedBy=default.target
EOF

    systemctl --user daemon-reload 2>/dev/null || true
    systemctl --user enable openclaw-gateway 2>/dev/null || true
    systemctl --user start openclaw-gateway 2>/dev/null || true

    ok "Gateway 已注册为 systemd 用户服务"
    info "管理命令："
    echo "    systemctl --user status openclaw-gateway   # 查看状态"
    echo "    systemctl --user restart openclaw-gateway  # 重启"
    echo "    journalctl --user -u openclaw-gateway -f   # 查看日志"

    if command -v loginctl &>/dev/null; then
        loginctl enable-linger "$(whoami)" 2>/dev/null || true
        info "已启用 linger，注销后服务继续运行"
    fi
}

# ──── 主流程 ────

main() {
    echo ""
    echo -e "${BOLD}🦞 大龙虾 (ClawPro) — Linux 安装配置${NC}"
    echo -e "   基于 OpenClaw 的中文 AI 智能体"
    echo "───────────────────────────────────────"
    echo ""

    # 1. Node.js
    if ! check_node; then
        if ask_yn "是否自动安装 Node.js 18+？" "y"; then
            install_node
        else
            fail "OpenClaw 需要 Node.js 18+ 运行环境"
        fi
    fi

    # 2. OpenClaw
    if ! check_openclaw; then
        install_openclaw
    fi

    # 3. API 配置
    configure_api

    # 4. 聊天平台
    configure_channels

    # 5. 后台服务
    if command -v systemctl &>/dev/null; then
        setup_service
    else
        echo ""
        info "未检测到 systemd，跳过后台服务注册"
        info "可手动运行: openclaw gateway run --allow-unconfigured"
    fi

    # 6. 完成
    echo ""
    echo "───────────────────────────────────────"
    echo -e "${GREEN}${BOLD}🦞 大龙虾安装配置完成！${NC}"
    echo ""
    echo "  快速开始："
    echo "    openclaw agent                    # 命令行聊天"
    echo "    openclaw gateway                  # 启动网关"
    echo "    openclaw dashboard                # 打开控制面板"
    echo ""
    echo "  配置文件: $OPENCLAW_CONFIG"
    echo "  推荐中转: https://oneapi.gs"
    echo ""
}

main "$@"
