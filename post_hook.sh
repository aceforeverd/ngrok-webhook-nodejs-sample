#!/bin/bash

set -e

pushd "$(dirname "$0")"


ZIP_FILE=$(realpath "$1")

if [ ! -r "$ZIP_FILE" ] ; then
        echo "$ZIP_FILE not exists"
        exit 1
fi

pushd "$(dirname "$ZIP_FILE")"

BASE=$(basename -s .zip "$ZIP_FILE")

rm -rf "$BASE"
mkdir -p "$BASE"

unzip -d "$BASE" "$ZIP_FILE"

pushd "$BASE"

mkdir -p artifact/

tar xf artifact.tar -C artifact/

pushd artifact/

# do the sync things

popd

popd

rm -r "$BASE"

popd

popd
