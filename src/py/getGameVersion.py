#!/usr/bin/python
# -*- coding: UTF-8 -*-


import json
import sys
import requests


sys.stdout.reconfigure(encoding='utf-8')


def getGameVersion(bundleKey, token):
    param = {
        "game_key": bundleKey,
    }
    payloadHeader = {
        'Origin': 'https://hotupdateapp.xq5.com'
    }
    payloadHeader['x-xq5-jwt'] = token
    url = 'https://hotupdateapi.xq5.com/v3/library/patch/list'
    res = requests.post(
        url, json=param, headers=payloadHeader, allow_redirects=True)
    res_json = json.loads(res.text)
    data = res_json["data"]
    if (data and len(data) > 0):
        version = data[0]["patch_version"]
        print(version)


if __name__ == '__main__':
    getGameVersion(sys.argv[1], sys.argv[2])
