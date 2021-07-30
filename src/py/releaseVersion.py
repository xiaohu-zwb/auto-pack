#!/usr/bin/python
# -*- coding: UTF-8 -*-

import json
import sys
import requests
import re

sys.stdout.reconfigure(encoding='utf-8')

payloadHeader = {}
_token = ""
_bundlesKey = []
_bundlesId = []


# 获取游戏库补丁列表
def getGameVersion(index):
    url = 'https://hotupdateapi.xq5.com/v3/library/patch/list'
    param = {
        "game_key": _bundlesKey[index],
    }
    res = requests.post(url, json=param, headers=payloadHeader)
    res_json = json.loads(res.text)
    if res_json['errno'] != '0':
        print(res_json['errmsg'])
        sys.exit(0)
    else:
        data = res_json["data"]
        if (len(data) > 0):
            setGameReleaseMax(
                data[0]["id"], index)


# 设置游戏库最大发布版本
def setGameReleaseMax(patch_id, index):
    url = 'https://hotupdateapi.xq5.com/v3/library/patch/version/max'
    param = {
        "game_id": None,
        "id": patch_id,
        "max_release": True,
    }
    res = requests.post(url, json=param, headers=payloadHeader)
    res_json = json.loads(res.text)
    if res_json['errno'] != '0':
        print(res_json['errmsg'])
        sys.exit(0)
    else:
        print(_bundlesKey[index] + "设置游戏库release-max成功")
        # 正式发布
        getGamePatchList(index)


# 获取补丁列表
def getGamePatchList(index):
    param = {
        "game_id": 96,
        "game_area_id": _bundlesId[index],
    }
    url = 'https://hotupdateapi.xq5.com/v3/child/patch/list'
    res = requests.post(
        url, json=param, headers=payloadHeader, allow_redirects=True)
    res_json = json.loads(res.text)
    if res_json['errno'] != '0':
        print(res_json['errmsg'])
        sys.exit(0)
    else:
        Befour_id = None
        Befour_library_version_id = None
        data = res_json["data"]
        if (data and len(data) > 0):
            # 拿到刚刚上传的版本信息
            patch_id = data[0]['id']
            library_version_id = data[0]['library_version_id']
            # 便历，拿到上次最大的release-max版本信息
            for item in data:
                if item['is_release'] == True:
                    Befour_id = item['id']
                    Befour_library_version_id = item['library_version_id']
                    break
        # 正式发布
        setGameReleaseMaxEx(patch_id, library_version_id,
                            Befour_id, Befour_library_version_id)


# 设置当前补丁预发布
def setGameReleaseMaxEx(patch_id, library_version_id, Befour_id, Befour_library_version_id):
    url = 'https://hotupdateapi.xq5.com/v3/child/patch/set'
    param = {
        "Befour_id": Befour_id,
        "Befour_library_version_id": Befour_library_version_id,
        "id": patch_id,
        "is_release": True,
        "library_version_id": library_version_id
    }
    res = requests.post(
        url, json=param, headers=payloadHeader)
    res_json = json.loads(res.text)
    if res_json['errno'] != '0':
        print(res_json['errmsg'])
        sys.exit(0)
    else:
        print("设置release-max成功")
        # 刷新CDN
        updateGameCDN(False, True)


# 最后一步，刷新CDN
def updateGameCDN(is_pre_release, is_release):
    param = {
        "game_id": 96,
        "is_pre_release": is_pre_release,
        "is_release": is_release
    }
    url = 'https://hotupdateapi.xq5.com/v3/child/gameversion/create'
    res = requests.post(
        url, json=param, headers=payloadHeader, allow_redirects=True)
    res_json = json.loads(res.text)
    if res_json['errno'] != '0':
        print(res_json['errmsg'])
        sys.exit(0)
    else:
        print("刷新CDN成功")


def getFrameVersion():
    param = {
        "game_id": 96,
    }
    url = 'https://hotupdateapi.xq5.com/v3/platform_patches'
    res = requests.get(url=url, params=param, headers=payloadHeader)
    res_json = json.loads(res.text)
    data = res_json["data"]
    if (len(data) > 0):
        for item in data:
            if item['is_release'] == True:
                current_id = item['id']
                break
    setFrameMax(data[0]["id"], current_id)


def setFrameMax(id, current_id):
    param = {
        "game_id": 96,
        "id": id,
        "current_id": current_id,
        "is_release": True
    }
    url = 'https://hotupdateapi.xq5.com/v3/platform_patch'
    res = requests.put(
        url, data=param, headers=payloadHeader)
    res_json = json.loads(res.text)
    if res_json['errno'] != '0':
        print(res_json['errmsg'])
        sys.exit(-1)
    else:
        print("设置release-max成功")
        updateFrameCDN()


def updateFrameCDN():
    param = {
        "game_id": 96,
        "is_release": True,
    }
    url = 'https://hotupdateapi.xq5.com/v3/platform/gameversion/create'
    res = requests.post(
        url, json=param, headers=payloadHeader)
    res_json = json.loads(res.text)
    if res_json['errno'] != '0':
        print(res_json['errmsg'])
        sys.exit(-1)
    else:
        print("刷新CDN成功")


if __name__ == '__main__':
    # 处理请求数量过大的问题
    requests.session().keep_alive = False
    requests.adapters.DEFAULT_RETRIES = 5
    # _bundles
    _bundlesInfo = sys.argv[1]
    # 处理字符串中的信息
    _bundlesKey = re.findall(
        "bundleKey\":\"(.*?)\",\"game_area_id", _bundlesInfo)
    _bundlesId = re.findall("game_area_id\":(.*?)}", _bundlesInfo)
    # token
    _token = sys.argv[2]
    payloadHeader = {
        'Origin': 'https://hotupdateapp.xq5.com',
        'x-xq5-jwt': _token,
        "Connection": "close"
    }
    # 框架正式发布
    is_framework = sys.argv[3]
    if (is_framework == "true"):
        getFrameVersion()
    # 子游戏正式发布
    for index in range(len(_bundlesKey)):
        getGameVersion(index)
