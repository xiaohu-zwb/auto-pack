#!/usr/bin/python
# -*- coding: UTF-8 -*-


import json
import sys
import requests


_token = ""


sys.stdout.reconfigure(encoding='utf-8')


def upload_zip(remarks, file_url, file_new_url):
    postUrl = "https://hotupdateapi.xq5.com/v3/platform/patch/add"
    payloadHeader = {
        'Origin': 'https://hotupdateapp.xq5.com',
        'x-xq5-jwt': _token
    }
    payloadData = {
        "game_id": 96,
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
                        headers=payloadHeader, allow_redirects=True)
    res_json = json.loads(res.text, encoding='utf-8')
    if res_json['errno'] != '0':
        print(res_json['errmsg'])
        sys.exit(-1)
    else:
        print("上传成功！！！")
        getFrameVersion()


def getFrameVersion():
    param = {
        "game_id": 96,
    }
    payloadHeader = {
        'Origin': 'https://hotupdateapp.xq5.com'
    }
    payloadHeader['x-xq5-jwt'] = _token
    url = 'https://hotupdateapi.xq5.com/v3/platform_patches'
    res = requests.get(url=url, params=param, headers=payloadHeader)
    res_json = json.loads(res.text)
    data = res_json["data"]
    if (len(data) > 0):
        for item in data:
            if item['is_pre_release'] == True:
                current_id = item['id']
                break
    setFramePreMax(data[0]["id"], current_id)


def setFramePreMax(id, current_id):
    param = {
        "game_id": 96,
        "id": id,
        "current_id": current_id,
        "is_pre_release": True
    }
    payloadHeader = {
        'Origin': 'https://hotupdateapp.xq5.com',
        'content-type': 'application/x-www-form-urlencoded',
        'x-xq5-jwt': _token
    }
    url = 'https://hotupdateapi.xq5.com/v3/platform_patch'
    res = requests.put(
        url, data=param, headers=payloadHeader)
    res_json = json.loads(res.text)
    if res_json['errno'] != '0':
        print(res_json['errmsg'])
        sys.exit(-1)
    else:
        print("设置pre-max成功")
        updateCDN()


def updateCDN():
    param = {
        "game_id": 96,
        "is_pre_release": True,
    }
    payloadHeader = {
        'Origin': 'https://hotupdateapp.xq5.com'
    }
    payloadHeader['x-xq5-jwt'] = _token
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
    # token必传
    if (sys.argv[1]):
        _token = sys.argv[1]
    upload_zip(sys.argv[2], sys.argv[3], sys.argv[4])
