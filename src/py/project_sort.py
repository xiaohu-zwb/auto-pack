#!/usr/bin/python
# -*- coding: UTF-8 -*-

import sys
import os
import shutil

sys.stdout.reconfigure(encoding='utf-8')


GAMECONFIG_CONTENT = []
projectPath = ""
packGames = []
containerGame = []
is_framework = False


def getGameConfig():
    print("check python version: " + sys.version)
    fo = open((projectPath + '/assets/framework/scripts/game_config/GameConfig_96.js'),
              mode='r', encoding="utf-8")
    print("start read " + fo.name)
    lines = fo.readlines()
    for line in lines:
        line = str(line).strip().replace("\n", "")
        if not line.startswith("game_key:"):
            continue
        index = line.find("//")
        if index != -1:
            line = line[:index].strip()
        GAMECONFIG_CONTENT.append(line)
    fo.close()


def isGameContained(game_key):
    for line in GAMECONFIG_CONTENT:
        index1 = line.lower().find("\"" + game_key + "\"")
        index2 = line.lower().find("\'" + game_key + "\'")
        # 如果该游戏是打包游戏并且在game_config中配置，那么不删除
        if (len(packGames) == 0 or game_key in packGames) and (index1 != -1 or index2 != -1):
            return True
    return False


def removeGamesByConfig():
    getGameConfig()
    # 获取games下所有的文件夹的绝对目录
    path = projectPath + '/assets/games'
    files = os.listdir(path)
    for item in files:
        game_path = os.path.join(path + '/', item)
        # 存在文件夹
        if os.path.isdir(game_path):
            game_key = os.path.basename(game_path)
            if not isGameContained(game_key):
                if os.path.exists(game_path):
                    shutil.rmtree(game_path)
                if(os.path.exists(game_path + ".meta")):
                    os.remove(game_path + ".meta")
            else:
                containerGame.append(game_key)


# 删除所有子游戏
def removeAllGames():
    path = projectPath + '/assets/games'
    files = os.listdir(path)
    for item in files:
        game_path = os.path.join(path + '/', item)
        if os.path.isfile(game_path):
            os.remove(game_path)
        elif os.path.isdir(game_path):
            shutil.rmtree(game_path)


if __name__ == "__main__":
    projectPath = sys.argv[1]
    is_framework = bool(sys.argv[2] == "true")
    if (is_framework):
        removeAllGames()
        print("删除所有子游戏完毕")
    else:
        packGames = sys.argv[3]
        removeGamesByConfig()
        print("共打包" + str(len(containerGame)) + "款子游戏")
