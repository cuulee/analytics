# -*- coding: utf8 -*-

import socket

def process(strQuery):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.connect(("localhost", 25335)) # TODO which port should we use ?

    s.send(strQuery + '\r\n')
    data = bytearray()
    while 1:
        chunk = s.recv(65536)
        if not chunk:
            break
        data.extend(chunk)

    return data.decode(encoding='utf-8')

