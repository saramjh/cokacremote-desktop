# 시작하기 — cokacremote Desktop Manager

[English](GETTING_STARTED.md) · [문제 해결](TROUBLESHOOTING.md) · [macOS 보안 안내](MACOS_SECURITY.md)

이 프로그램은 **내 컴퓨터에서 실행되는** [kstost/cokacremote](https://github.com/kstost/cokacremote) MCP 서버, Cloudflare Quick Tunnel, OAuth 인증 상태를 관리하는 도구입니다. ChatGPT에서 연결을 승인하면 본인 컴퓨터의 강력한 작업 도구에 접근할 수 있으므로, 신뢰하는 계정과 권한만 승인하세요.

**주의:** 관리자 프로그램에 MCP 서버나 개인 OAuth 키가 포함된 것은 아닙니다. 필수 프로그램 설치, ChatGPT 연결 등록과 권한 승인을 자동으로 완료하지도 않습니다.

## 1. 운영체제별 다운로드

| 사용 환경 | 릴리스 | 받아야 하는 파일 | 알아둘 점 |
|---|---|---|---|
| Windows 10/11 | [v0.3.0](https://github.com/saramjh/cokacremote-desktop/releases/tag/v0.3.0) | `cokacremote-manager-windows-v0.3.0.zip` | 압축 해제 후 최상위 `INSTALL.cmd` 실행. SmartScreen 경고 가능 |
| Apple Silicon Mac (M1~M4), 앱 파일 | [v0.4.0-rc.2 시험판](https://github.com/saramjh/cokacremote-desktop/releases/tag/v0.4.0-rc.2) | `UNNOTARIZED.dmg` 또는 `UNNOTARIZED.zip` | **Apple 미공증.** Gatekeeper 차단 가능, 앱별 직접 승인 필요 |
| Apple Silicon Mac, 소스 빌드 | [v0.4.0-rc.2 시험판](https://github.com/saramjh/cokacremote-desktop/releases/tag/v0.4.0-rc.2) | `SOURCE-INSTALL.tar.gz` | 무료 Node.js/npm, Rust, Xcode 명령줄 도구 필요. 원클릭 아님 |
| Intel Mac | — | — | 검증된 전용 배포본 없음 |

GitHub의 **Latest** 표시는 Windows 안정판 기준일 수 있습니다. Mac 최신 시험판이 자동으로 표시되는 것은 아닙니다.

## 2. 설치하기

**Windows:** ZIP을 **모두** 압축 해제하고, 압축을 푼 폴더 최상위의 `INSTALL.cmd`를 실행하세요. Windows 경고가 뜨면 출처와 내용을 확인하고 결정하세요. Defender/SmartScreen을 통째로 끄지 마세요. 신규 PC에서는 필수 프로그램을 따로 준비해야 할 수 있습니다.

**Mac — DMG/ZIP:** [macOS 시험판 릴리스](https://github.com/saramjh/cokacremote-desktop/releases/tag/v0.4.0-rc.2)의 미공증 앱입니다. ZIP으로 바꿔도 Gatekeeper 문제는 없어지지 않습니다. 출처와 체크섬을 확인하고, 신뢰하는 앱이 차단됐을 때만 **시스템 설정 → 개인정보 보호 및 보안 → 그래도 열기**를 통해 해당 앱을 승인하세요. [자세한 안내](MACOS_SECURITY.md).

**Mac — 소스 빌드:** 무료 [Node.js](https://nodejs.org/), [Rust](https://rustup.rs/), Xcode Command Line Tools(`xcode-select --install`)를 미리 설치하고, 릴리스에서 `cokacremote-manager-macos-arm64-v0.4.0-rc.2-SOURCE-INSTALL.tar.gz`를 다운로드하세요.

터미널에서 다음을 입력합니다.

```bash
cd ~/Downloads
tar -xzf cokacremote-manager-macos-arm64-v0.4.0-rc.2-SOURCE-INSTALL.tar.gz
bash cokacremote-manager-v0.4.0-rc.2/INSTALL-MAC.command
```

화면의 설명을 검토하고 동의하는 경우에만 `y`를 입력하세요. 테스트 → 로컬 빌드 → 임시 서명(ad-hoc) 검증 → `~/Applications` 설치 순서로 진행합니다. **기존 앱을 덮어쓰지 않으며**, Gatekeeper를 비활성화하거나 격리 표시를 강제로 지우지 않습니다. 이 방법도 Apple 공증을 받는 것은 아닙니다. 이미 설치했다면 `open "$HOME/Applications/cokacremote Manager.app"`로 실행하세요.

## 3. 앱에서 환경 준비하기

1. 상단의 **Language**에서 한국어 등 원하는 언어를 고릅니다.
2. **구성요소 확인(Check dependencies)**을 실행합니다. Node.js/npm, Git, cloudflared, MCP 서버가 있는지 검사합니다. 설치 동의 없이 임의로 설치하지 않습니다.
3. Mac의 의존성 설치는 기존 Homebrew가 있어야 가능합니다. Homebrew 자체는 자동 설치하지 않으므로 **깨끗한 Mac에서 완전 자동 설치는 아직 지원하지 않습니다.**
4. **전체 확인(Verify all)**으로 서버·터널·OAuth를 검사합니다. **초록색**은 검증됨, **회색**은 확인 근거 부족, **노란색**은 주의 필요, **빨간색**은 오프라인 또는 소유권 문제입니다. [인디케이터 설명](STATUS_MODEL.md).
5. 문제가 있으면 **재사용/복구(Reuse / Repair)**를 사용하세요. 정상적인 터널을 무작정 강제 재시작하면 주소가 바뀌어 ChatGPT 연결이 끊어질 수 있습니다.

## 4. ChatGPT 연결하기

1. 앱의 **공개 MCP 주소(Public MCP address)**를 복사합니다. 실제 주소는 `https://…/mcp` 형태입니다.
2. ChatGPT의 **Plugins / 사용자 지정 MCP 서버** 추가 기능이 표시되는 계정이라면, 본인 계정에서 해당 주소로 연결을 등록합니다. 이 기능은 계정·워크스페이스 권한에 따라 제공되지 않을 수 있습니다.
3. 요청 권한을 확인하고 OAuth 승인을 진행합니다. **OAuth 승인 키는 정식 승인 화면에만 입력**해야 합니다. ChatGPT 채팅창, GitHub 이슈, 스크린샷에 공유하면 안 됩니다.
4. ChatGPT에서 연결이 활성화됐는지 확인한 뒤, 파일 상태 조회 등 **읽기 전용** 작업부터 시험합니다.

앱이 초록색이어도 **ChatGPT 플러그인 등록 성공까지 보장하는 것은 아닙니다.** [연결 방법 상세](CHATGPT_SETUP.md).

## 5. 문제 발생 시

- **Mac 앱이 차단됨:** 미공증인지 확인하고 [macOS 보안 안내](MACOS_SECURITY.md) 참조
- **회색/노란색 인디케이터:** [상태 정의](STATUS_MODEL.md) 확인 후 재검증
- **ChatGPT에서 도구가 안 보임:** ChatGPT 계정 내 연결 등록·승인 여부 확인
- **Quick Tunnel 주소 변경:** ChatGPT에서 연결 URL을 갱신하고 다시 승인
- **컴퓨터 절전/종료:** 실행 중인 로컬 서버에 원격 연결할 수 없음

[전체 문제 해결](TROUBLESHOOTING.md). 문의할 때는 OS, 버전, 다운로드 파일명, 오류 문구만 정리하고 **승인 키·토큰·민감한 로그는 절대 전송하지 마세요.**
