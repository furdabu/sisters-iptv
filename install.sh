#!/bin/bash

echo "Sistersの準備を開始します。"

# Function to check if a command is available
check_command_availability() {
    local command=$1
    if ! command -v "$command" &> /dev/null; then
        echo "$command は利用できません。インストールしてから再度実行してください。"
        exit 1
    else
        echo "$command は利用可能です。"
    fi
}

# Check if required commands are available
for cmd in yq git make cmake ffmpeg; do
    check_command_availability "$cmd"
done

# Define paths
repo_url="git@github.com:xtne6f/tsreadex.git"
current_dir=$(pwd)
build_dir="/tmp"
third_party_dir="$current_dir/thirdparty"
tsreadex_dir="$build_dir/tsreadex"
echo "Sistersに必要なリソースを準備します。"
# Display steps
echo "リポジトリからクローン中..."
cd "$build_dir"
git clone "$repo_url"

cd "$tsreadex_dir"

echo "cmakeを実行中..."
cmake .

echo "makeを実行中..."
make

echo "ビルド完了。ファイルを移動します..."
built_tsreadex="$tsreadex_dir/tsreadex"
destination="$third_party_dir/tsreadex"

mkdir -p "$third_party_dir"
mv "$built_tsreadex" "$destination"

echo "tsreadexはビルドされ、 $destination に移動しました。"

cd "$current_dir"

echo "------------------------------------------"
echo "     Mirakurunとの接続を設定します"
echo "------------------------------------------"

# Get Mirakurun URL from user input or use default
read -p "MirakurunのURLを入力してください (デフォルト: http://localhost:40772): " mirakurun_url
mirakurun_url=${mirakurun_url:-http://localhost:40772}

# Validate Mirakurun URL
if ! curl --output /dev/null --silent --head --fail "$mirakurun_url"; then
    echo "無効なURLです: $mirakurun_url"
    exit 1
fi

# Check if Mirakurun API is accessible
mirakurun_api_url="$mirakurun_url/api/channels"
if curl --output /dev/null --silent --head --fail "$mirakurun_api_url"; then
    echo "MirakurunのAPIにアクセスできました: $mirakurun_api_url"
else
    echo "MirakurunのAPIにアクセスできません: $mirakurun_api_url"
    exit 1
fi

echo "設定ファイルを自動生成します..."

config_output_file="channels.json"

curl -s "$mirakurun_api_url" | \
  jq '[ reduce .[] as $ch ({}; 
        reduce $ch.services[] as $svc (.; 
          .[$svc.name] |= if . == null then 
            { type: $ch.type, name: $svc.name, id: $svc.id } 
          else 
            if $svc.id < .id then 
              .id = $svc.id | . 
            else 
              . 
            end 
          end
        )
      ) | .[] ]' \
  > "$config_output_file"

echo "設定ファイルを生成しました: $config_output_file"

