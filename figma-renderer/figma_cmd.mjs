/**
 * Figma WebSocket command runner
 * Usage: node figma_cmd.mjs --command <cmd> --params '<json>' [--channel <ch>]
 *
 * Examples:
 *   node figma_cmd.mjs --command get_document_info --params '{}'
 *   node figma_cmd.mjs --command create_rectangle --params '{"x":100,"y":100,"width":200,"height":200,"name":"Box"}'
 *   node figma_cmd.mjs --command set_fill_color --params '{"nodeId":"1:2","r":1,"g":1,"b":1,"a":1}'
 */

import WebSocket from "ws";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));
const CHANNEL_CACHE_PATH = path.join(CURRENT_DIR, "channel_cache.js");
const WS_URL = "ws://localhost:3055";

async function readCachedChannel() {
  try {
    const contents = await fs.readFile(CHANNEL_CACHE_PATH, "utf8");
    const match = contents.match(/lastChannel\s*=\s*["']([^"']+)["']/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

async function writeCachedChannel(channel) {
  const contents = `export const lastChannel = "${channel}";\n`;
  await fs.writeFile(CHANNEL_CACHE_PATH, contents, "utf8");
}

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, "");
    const value = argv[i + 1];
    if (key && value !== undefined) args[key] = value;
  }
  return args;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const args = parseArgs(process.argv);

  if (!args.command) {
    console.error("Usage: node figma_cmd.mjs --command <cmd> --params '<json>' [--channel <ch>]");
    process.exit(1);
  }

  const channel = args.channel || (await readCachedChannel());
  if (!channel) {
    console.error("채널을 찾을 수 없어요. --channel 옵션으로 지정해주세요.");
    process.exit(1);
  }

  // 채널 캐시 업데이트
  if (args.channel) await writeCachedChannel(args.channel);

  let params = {};
  if (args.params) {
    try {
      params = JSON.parse(args.params);
    } catch {
      console.error("--params 는 유효한 JSON이어야 해요.");
      process.exit(1);
    }
  }

  const ws = new WebSocket(WS_URL);
  await new Promise((resolve, reject) => {
    ws.once("open", resolve);
    ws.once("error", (e) => reject(new Error(`WebSocket 연결 실패: ${e.message}`)));
  });

  // 메시지 큐
  const queue = [];
  ws.on("message", (data) => {
    try {
      queue.push(JSON.parse(data.toString()));
    } catch {}
  });

  ws.send(JSON.stringify({ type: "join", channel }));
  await sleep(400);

  ws.send(JSON.stringify({ type: "message", channel, message: { command: args.command, params } }));

  // 응답 대기
  const timeout = Number(args.timeout) || 8000;
  const started = Date.now();
  let result = null;

  while (Date.now() - started < timeout) {
    for (let i = 0; i < queue.length; i++) {
      const msg = queue[i];
      if (msg?.type === "broadcast" && msg?.message?.result !== undefined) {
        result = msg.message.result;
        queue.splice(i, 1);
        break;
      }
    }
    if (result !== null) break;
    await sleep(50);
  }

  ws.close();

  if (result === null) {
    console.error("Timeout: 응답이 없어요. Figma 플러그인이 연결돼 있는지 확인해주세요.");
    process.exit(1);
  }

  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error("오류:", err.message);
  process.exit(1);
});
