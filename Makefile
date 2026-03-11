APP_NAME = openclaw-pro
VERSION ?= 0.1.0
DIST_DIR = dist

.PHONY: all clean dev build \
	build-darwin-amd64 build-darwin-arm64 \
	build-linux-amd64 build-linux-arm64 \
	build-windows-amd64 build-windows-arm64 \
	package

all: clean build package

dev:
	wails dev

# ──── 单平台构建 ────

build-darwin-amd64:
	@echo "🦞 Building $(APP_NAME) darwin/amd64..."
	wails build -platform darwin/amd64 -o $(APP_NAME)-darwin-amd64
	@echo "✓ darwin/amd64 done"

build-darwin-arm64:
	@echo "🦞 Building $(APP_NAME) darwin/arm64..."
	wails build -platform darwin/arm64 -o $(APP_NAME)-darwin-arm64
	@echo "✓ darwin/arm64 done"

build-linux-amd64:
	@echo "🦞 Building $(APP_NAME) linux/amd64..."
	wails build -platform linux/amd64 -o $(APP_NAME)-linux-amd64
	@echo "✓ linux/amd64 done"

build-linux-arm64:
	@echo "🦞 Building $(APP_NAME) linux/arm64..."
	wails build -platform linux/arm64 -o $(APP_NAME)-linux-arm64
	@echo "✓ linux/arm64 done"

build-windows-amd64:
	@echo "🦞 Building $(APP_NAME) windows/amd64..."
	wails build -platform windows/amd64 -nsis -o $(APP_NAME)-windows-amd64.exe
	@echo "✓ windows/amd64 done"

build-windows-arm64:
	@echo "🦞 Building $(APP_NAME) windows/arm64..."
	wails build -platform windows/arm64 -o $(APP_NAME)-windows-arm64.exe
	@echo "✓ windows/arm64 done"

# ──── 全平台构建 ────

build: build-darwin-arm64 build-darwin-amd64 build-linux-amd64 build-linux-arm64 build-windows-amd64 build-windows-arm64
	@echo ""
	@echo "🦞 All platforms built successfully"

# ──── 打包分发 ────

package:
	@mkdir -p $(DIST_DIR)
	@echo "📦 Packaging release archives..."
	@# macOS
	@if [ -f build/bin/$(APP_NAME)-darwin-amd64 ]; then \
		tar -czf $(DIST_DIR)/$(APP_NAME)-$(VERSION)-darwin-amd64.tar.gz \
			-C build/bin $(APP_NAME)-darwin-amd64; \
		echo "  ✓ $(DIST_DIR)/$(APP_NAME)-$(VERSION)-darwin-amd64.tar.gz"; \
	fi
	@if [ -f build/bin/$(APP_NAME)-darwin-arm64 ]; then \
		tar -czf $(DIST_DIR)/$(APP_NAME)-$(VERSION)-darwin-arm64.tar.gz \
			-C build/bin $(APP_NAME)-darwin-arm64; \
		echo "  ✓ $(DIST_DIR)/$(APP_NAME)-$(VERSION)-darwin-arm64.tar.gz"; \
	fi
	@# Linux
	@if [ -f build/bin/$(APP_NAME)-linux-amd64 ]; then \
		tar -czf $(DIST_DIR)/$(APP_NAME)-$(VERSION)-linux-amd64.tar.gz \
			-C build/bin $(APP_NAME)-linux-amd64; \
		echo "  ✓ $(DIST_DIR)/$(APP_NAME)-$(VERSION)-linux-amd64.tar.gz"; \
	fi
	@if [ -f build/bin/$(APP_NAME)-linux-arm64 ]; then \
		tar -czf $(DIST_DIR)/$(APP_NAME)-$(VERSION)-linux-arm64.tar.gz \
			-C build/bin $(APP_NAME)-linux-arm64; \
		echo "  ✓ $(DIST_DIR)/$(APP_NAME)-$(VERSION)-linux-arm64.tar.gz"; \
	fi
	@# Windows
	@if [ -f build/bin/$(APP_NAME)-windows-amd64.exe ]; then \
		cd build/bin && zip -q ../../$(DIST_DIR)/$(APP_NAME)-$(VERSION)-windows-amd64.zip \
			$(APP_NAME)-windows-amd64.exe; \
		echo "  ✓ $(DIST_DIR)/$(APP_NAME)-$(VERSION)-windows-amd64.zip"; \
	fi
	@if [ -f build/bin/$(APP_NAME)-windows-arm64.exe ]; then \
		cd build/bin && zip -q ../../$(DIST_DIR)/$(APP_NAME)-$(VERSION)-windows-arm64.zip \
			$(APP_NAME)-windows-arm64.exe; \
		echo "  ✓ $(DIST_DIR)/$(APP_NAME)-$(VERSION)-windows-arm64.zip"; \
	fi
	@echo ""
	@echo "📦 All packages in $(DIST_DIR)/"

# ──── 清理 ────

clean:
	@rm -rf build/bin $(DIST_DIR)
	@echo "🧹 Cleaned"
