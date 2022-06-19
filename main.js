'use strict'

import * as util from 'util'
import * as fs from 'fs'
import * as path from 'path'

export const readFile = (filePath) => {
  let contents = JSON.parse(fs.readFileSync(filePath, { encoding: 'utf-8' }))
  return contents
}

import assert from "assert"

/*
  参考: https://wikiwiki.jp/majsoul-api/%E7%89%8C%E8%AD%9C%E3%82%92%E8%AA%AD%E3%82%80%E3%81%AB%E3%82%83#wed8c5c1
*/

function buildRecordData(filePath) {
  let contents = readFile(filePath)

  const rounds = []
  let furiten = null
  let numDiscarded = null
  let lastDiscardSeat = null
  let gameDetail = contents.data.data
  for (const action of gameDetail.actions) {
    let itemType = action.type
    if (itemType !== 1) {
      continue
    }

    let actionName = action.result.name
    let actionData = action.result.data
    if (action.result.name === ".lq.RecordDealTile") {
      continue
    }

    if (action.result.name === ".lq.RecordNewRound") {
      rounds.push(
        [0, 1, 2, 3].map((seat) => ({
          ...(action.result.data[`tiles${seat}`].length === 14
            ? {
              parent: true,
              paishan: action.result.data.paishan
            } : {}),
          tiles: action.result.data[`tiles${seat}`],
          shanten: 1
        }))
      )
      furiten = Array(4).fill(false)
      numDiscarded = 0
      lastDiscardSeat = null
      continue
    }

    const curRound = rounds[rounds.length - 1]
    const numPlayers = 4
    switch (actionName) {
      // チー・ポン・大明槓
      case ".lq.RecordChiPengGang":
        curRound[actionData.seat].meld = (curRound[actionData.seat].meld || 0) + 1
        break

      // 打牌
      case ".q.RecordDiscardTile":
        lastDiscardSeat = actionData.seat
        furiten = actionData.zhenting
        if (!curRound[actionData.seat].liqi && (actionData.is_liqi || actionData.is_wliqi)) {
          curRound[actionData.seat].liqi = numDiscarded / numPlayers + 1
          if (actionData.tingpais && actionData.tingpais.length) {
            curRound[actionData.seat].liqi_tingpai = actionData.tingpais.map((x) => x.tile)
            // TODO: 自分視点での見えていない当たり牌の枚数を数える
            //curRound[action.data.seat].liqi_tingpai_remaining = 
          }
        }
        if (actionData.is_wliqi) {
          curRound[actionData.seat].wliqi = true
        }
        numDiscarded++
        break

      // 流局
      case ".lq.RecordNoTile":
        // TODO: 流し満貫の処理を調べる
        if (actionData.liujumanguan) {

        }
        actionData.players.forEach((player, seat) => {
          curRound[seat].tingpai = player.tingpai
        })
        break

      // 和了
      case ".lq.RecordHule":
        actionData.hules.forEach((player) => {
          curRound[player.seat].hule = [
            actionData.delta_scores[player.seat] - (player.liqi ? 1000 : 0),
            [].concat(...player.fans.map((x) => Array(x.val).fill(x.id))),
            numDiscarded / numPlayers + 1
          ]
          // TODO: ダブロンとパオの処理
          // point_rongはロンあがりの場合の点数
          // if (!player.zimo && curRound[player.seat].hule)

          const numLosingPlayers = actionData.delta_scores.filter((x) => x < 0).length
          if (player.zimo) {
            curRound[player.seat].zimo = true
            if (furiten[player.seat]) {
              curRound[player.seat].furiten_zimo = true
            }
            if (numLosingPlayers === 1) {
              actionData.delta_scores.forEach((score, seat) => {
                if (score < 0) {
                  curRound[seat].paopai = Math.abs(score)
                }
              })
            }
          } else {
            actionData.delta_scores.forEach((score, seat) => {
              if (score < 0) {
                curRound[seat][seat === lastDiscardSeat ? "放銃" : "包牌"] = Math.abs(score)
              }
            })
          }
        })
        break

      // 北抜き
      case ".lq.RecordBaBei":
      // 暗槓、加槓
      case ".lq.RecordAnGangAddGang":
        lastDiscardSeat = actionData.seat;
        break

      // 途中流局
      case ".lq.RecordLiuJu":
        curRound.forEach((x) => (x.liuju_type = actionData.type))
        break

      default:
      // console.log(action)
    }
  }
  console.log(util.inspect(rounds[0], {showHidden: false, depth: null, colors: false}))
  // console.log(rounds)
}

function main() {
  let filePath = process.argv[2] || './mahjongsoul_paifu_220619-08a20b82-9b8f-4cff-87c8-9f00c832d510.txt'
  buildRecordData(filePath)
}
main()

