#!/bin/sh
# 업로드 볼륨 소유권을 맞춘 뒤 비루트로 내려간다.
#
# 왜 필요한가: Railway(및 대부분의 PaaS)는 볼륨을 root:root 0755로 마운트한다. 이미지가
# `USER app`으로 돌면 마운트 지점에 쓸 수 없어 업로드가 전부 EACCES로 죽는다 —
# 2026-08-10 운영 컨테이너에서 실측 확인. 그래서 root로 시작해 chown만 하고 즉시 권한을 버린다.
#
# setpriv는 util-linux(베이스 이미지에 포함)라 gosu 같은 추가 바이너리가 필요 없다.
# dumb-init이 PID 1이므로 시그널은 여기서 exec된 프로세스까지 그대로 전달된다.
set -e

UPLOAD_DIR="${UPLOAD_DIR:-/app/apps/backend/uploads}"
mkdir -p "$UPLOAD_DIR"
# 볼륨이 없을 때도(로컬 docker run) 무해하다. -R은 재배포 시 기존 파일 소유권까지 정정한다.
chown -R 10001:10001 "$UPLOAD_DIR"

# root로 시작하므로 HOME이 /root다 — 그대로 내려가면 pnpm이 캐시/스토어를 못 써서 죽는다.
export HOME=/home/app

exec setpriv --reuid=10001 --regid=10001 --clear-groups "$@"
