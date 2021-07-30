import json
import sys
import requests

payloadHeader = {}


def setGamePreMaxEx(data):
    url = 'https://hotupdateapi.xq5.com/v3/child/patch/set'
    for item in data:
        for index in range(len(item)):
            if (index < len(item) - 1):
                param = {
                    "Befour_id": item[index][0],
                    "Befour_library_version_id": item[index][1],
                    "id": item[index + 1][0],
                    "is_pre_release": True,
                    "library_version_id": item[index + 1][1],
                }
                res = requests.post(url, json=param, headers=payloadHeader)
                res_json = json.loads(res.text)
                if res_json['errno'] != '0':
                    print(res_json['errmsg'])
                    sys.exit(0)
                else:
                    print("设置pre-max成功")


if __name__ == '__main__':
    payloadHeader = {
        'Origin': 'https://hotupdateapp.xq5.com',
        'x-xq5-jwt': "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxMDM5LCJ1c2VyX25hbWUiOiLnq6DmrablhbUiLCJncm91cF9pZCI6MiwiaXNfc3VwZXJ1c2VyIjpmYWxzZSwiZXhwIjoxNjI2NDg2MDY5fQ.mi6BgjfMhFuCzBj8-n0NAFE6_vKfF_0KncIKCl-i_hc",
        "Connection": "close"
    }
    data = [
        [
            [10925, 9120],
            [11082, 9294],
            [11106, 9318],
            [11135, 9348]
        ],
        [
            [10931, 9126],
            [11083, 9295],
            [11107, 9319],
            [11136, 9349]
        ],
        [
            [10862, 9067],
            [11084, 9296],
            [11108, 9320],
            [11137, 9350]
        ],
        [
            [11069, 9281],
            [11085, 9297],
            [11109, 9321],
            [11138, 9351]
        ],
        [
            [10860, 9047],
            [11086, 9298],
            [11110, 9322],
            [11139, 9352]
        ],
        [
            [10921, 9116],
            [11087, 9299],
            [11111, 9323],
            [11140, 9353]
        ],
        [
            [10956, 9153],
            [11088, 9300],
            [11112, 9324],
            [11141, 9354]
        ],
        [
            [10857, 9066],
            [11089, 9301],
            [11113, 9325],
            [11142, 9355]
        ],
        [
            [10856, 9056],
            [11090, 9302],
            [11114, 9326],
            [11143, 9356]
        ],
        [
            [10855, 9046],
            [11091, 9303],
            [11115, 9327],
            [11144, 9357]
        ],
        [
            [10854, 9058],
            [11092, 9304],
            [11116, 9328],
            [11145, 9358]
        ],
        [
            [10906, 9101],
            [11093, 9305],
            [11117, 9329],
            [11146, 9359]
        ],
        [
            [10928, 9123],
            [11094, 9306],
            [11118, 9330],
            [11147, 9360]
        ],
        [
            [10852, 9030],
            [11095, 9307],
            [11119, 9331],
            [11148, 9361]
        ],
        [
            [10851, 9021],
            [11096, 9308],
            [11120, 9332],
            [11149, 9362]
        ],
        [
            [10850, 9016],
            [11121, 9333],
            [11150, 9363]
        ],
        [
            [10849, 9063],
            [11122, 9334],
            [11151, 9364]
        ],
        [
            [10848, 9060],
            [11123, 9335],
            [11152, 9365]
        ],
        [
            [10847, 9062],
            [11124, 9336],
            [11153, 9366]
        ],
    ]
    # setGamePreMaxEx(data)
