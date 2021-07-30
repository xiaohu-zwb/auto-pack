#!/usr/bin/python
# -*- coding: UTF-8 -*-

import json
import sys
import requests

_token = ""
_bundleKey = ""
_areaId = ""
payloadHeader = {}


sys.stdout.reconfigure(encoding='utf-8')


# 上传子游戏补丁
def upload_zip(remarks, file_url, file_new_url):
    postUrl = "https://hotupdateapi.xq5.com/v3/library/patch/add/new"
    payloadData = {
        "game_key": _bundleKey,
        "remarks": remarks,
    }
    basename = ""
    if sys.platform == "win32":
        basename = file_url.split('\\')[-1]
    elif sys.platform == "darwin":
        basename = file_url.split('/')[-1]
    payloadFiles = {
        'file': (basename, open(file_url, 'rb'), 'application/x-zip-compressed'),
        'file_new': (basename, open(file_new_url, 'rb'), 'application/x-zip-compressed'),
    }
    res = requests.post(postUrl, data=payloadData, files=payloadFiles,
                        headers=payloadHeader, allow_redirects=True, timeout=10)
    res_json = json.loads(res.text, encoding='utf-8')
    if res_json['errno'] != '0':
        print(res_json['errmsg'])
        sys.exit(0)
    else:
        print("上传成功！！！")
        # 上传成功，设置成游戏库最大预发布版本
        getGameVersion()


# 获取游戏库补丁列表
def getGameVersion():
    url = 'https://hotupdateapi.xq5.com/v3/library/patch/list'
    param = {
        "game_key": _bundleKey,
    }
    res = requests.post(url, json=param, headers=payloadHeader,
                        allow_redirects=True, timeout=10)
    res_json = json.loads(res.text)
    if res_json['errno'] != '0':
        print(res_json['errmsg'])
        sys.exit(0)
    else:
        data = res_json["data"]
        if (len(data) > 0):
            setGamePreMax(
                data[0]["id"], data[0]["patch_code"], data[0]["patch_version"])


# 设置游戏库最大预发布版本
def setGamePreMax(patch_id, patch_code, patch_version):
    url = 'https://hotupdateapi.xq5.com/v3/library/patch/version/max'
    param = {
        "game_id": None,
        "id": patch_id,
        "max_pre_release": True,
    }
    res = requests.post(url, json=param, headers=payloadHeader,
                        allow_redirects=True, timeout=10)
    res_json = json.loads(res.text)
    if res_json['errno'] != '0':
        print(res_json['errmsg'])
        sys.exit(0)
    else:
        print(_bundleKey + "设置游戏库pre-max成功")
        bindPatchVersion(patch_id, patch_code, patch_version)


def bindPatchGame():
    url = 'https://hotupdateapi.xq5.com/v3/child/bind/update'
    param = {
        "game_id": 96,
        "game_area_id": [_areaId]
    }
    res = requests.post(url, json=param, headers=payloadHeader,
                        allow_redirects=True, timeout=10)
    res_json = json.loads(res.text)
    if res_json['errno'] != '0':
        print(res_json['errmsg'])
        sys.exit(0)
    else:
        is_bind = res_json['data']["bind"][0]
        # 没绑定过
        if (is_bind == 0):
            param = {
                "game_area_id": _areaId,
                "game_id": 96,
                "game_key": _bundleKey
            }
            url = 'https://hotupdateapi.xq5.com/v3/library/child/bind'
            res = requests.post(
                url, json=param, headers=payloadHeader)
            res_json = json.loads(res.text)
            if res_json['errno'] != '0':
                print(res_json['errmsg'])
                sys.exit(0)
            else:
                print("绑定游戏库成功")


def bindPatchVersion(patch_id, patch_code, patch_version):
    # 如果子游戏未绑定游戏库，那么先走绑定逻辑，否则直接跳过
    bindPatchGame()
    param = {
        "game_area_id": str(_areaId),
        "game_id": 96,
        "library_version_id": patch_id,
        "patch_code": patch_code,
        "patch_version": patch_version,
    }
    url = 'https://hotupdateapi.xq5.com/v3/child/patch/release'
    res = requests.post(
        url, json=param, headers=payloadHeader, allow_redirects=True, timeout=10)
    res_json = json.loads(res.text)
    if res_json['errno'] != '0':
        print(res_json['errmsg'])
        sys.exit(0)
    else:
        print("自动绑定新版本成功")
        getGamePatchList()


# 获取补丁列表
def getGamePatchList():
    param = {
        "game_id": 96,
        "game_area_id": str(_areaId),
    }
    url = 'https://hotupdateapi.xq5.com/v3/child/patch/list'
    res = requests.post(
        url, json=param, headers=payloadHeader, allow_redirects=True, timeout=10)
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
            # 便历，拿到上次最大的pre-max版本信息
            for item in data:
                if item['is_pre_release'] == True:
                    Befour_id = item['id']
                    Befour_library_version_id = item['library_version_id']
                    break
        # 设置当前预发布最大版本
        setGamePreMaxEx(patch_id, library_version_id,
                        Befour_id, Befour_library_version_id)


# 设置当前补丁预发布
def setGamePreMaxEx(patch_id, library_version_id, Befour_id, Befour_library_version_id):
    url = 'https://hotupdateapi.xq5.com/v3/child/patch/set'
    param = {
        "Befour_id": Befour_id,
        "Befour_library_version_id": Befour_library_version_id,
        "id": patch_id,
        "is_pre_release": True,
        "library_version_id": library_version_id
    }
    res = requests.post(
        url, json=param, headers=payloadHeader, allow_redirects=True, timeout=10)
    res_json = json.loads(res.text)
    if res_json['errno'] != '0':
        print(res_json['errmsg'])
        sys.exit(0)
    else:
        print(_bundleKey + "设置pre-max成功")
        # 刷新CDN
        updateCDN(True, False)


# 最后一步，刷新CDN
def updateCDN(is_pre_release, is_release):
    param = {
        "game_id": 96,
        "is_pre_release": is_pre_release,
        "is_release": is_release
    }
    url = 'https://hotupdateapi.xq5.com/v3/child/gameversion/create'
    res = requests.post(
        url, json=param, headers=payloadHeader, allow_redirects=True, timeout=10)
    res_json = json.loads(res.text)
    if res_json['errno'] != '0':
        print(res_json['errmsg'])
        sys.exit(0)
    else:
        print("刷新CDN成功")


def addGameToLib(game_name, remarks, file_url, file_new_url):
    url = "https://hotupdateapi.xq5.com/v3/library/list"
    res = requests.post(
        url, headers=payloadHeader, allow_redirects=True, timeout=10)
    res_json = json.loads(res.text)
    if res_json['errno'] != '0':
        print(res_json['errmsg'])
        sys.exit(0)
    else:
        print("获取游戏库列表成功")
        flag = False
        data = res_json['data']
        for item in data:
            if (item["game_key"] == _bundleKey):
                flag = True
        if (flag):
            upload_zip(remarks, file_url, file_new_url)
        else:
            print("该游戏不存在游戏库")
            # 先添加一个游戏库
            url = "https://hotupdateapi.xq5.com/v3/library/add"
            param = {
                "game_key": _bundleKey,
                "name": game_name + "（赣牌圈）",
                "nickname": "待填"
            }
            res = requests.post(
                url, json=param, headers=payloadHeader, allow_redirects=True, timeout=10)
            if res_json['errno'] != '0':
                print(res_json['errmsg'])
                sys.exit(0)
            else:
                print("添加子游戏库成功")
                # 上传包体
                upload_zip(remarks, file_url, file_new_url)


if __name__ == '__main__':
    # 处理请求数量过大的问题
    requests.session().keep_alive = False
    requests.adapters.DEFAULT_RETRIES = 5
    # bundleKey
    if (sys.argv[1]):
        _bundleKey = sys.argv[1]
    # token
    if (sys.argv[2]):
        _token = sys.argv[2]
    # game_area_id
    if (sys.argv[3]):
        _areaId = sys.argv[3]
    # 全局变量的请求头
    payloadHeader = {
        'Origin': 'https://hotupdateapp.xq5.com',
        'x-xq5-jwt': _token,
        "Connection": "close"
    }
    # 添加子游戏库
    addGameToLib(sys.argv[4], sys.argv[5], sys.argv[6], sys.argv[7])
