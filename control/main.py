#!/usr/bin/python
import platform
import signal
import time
from datetime import datetime
import requests

class DummyINA260:
    def __init__(self, v=5.0, i=1.0):
        self.v = v
        self.i = i
    def start(self):
        time.sleep(1)
    def get_voltage(self):
        return self.v
    def get_current(self):
        return self.i

class RealINA260:
    def __init__(self, addr=0x40):
        self.ina260 = INA260(dev_address=addr)
    def start(self):
        self.ina260.reset_chip()
        time.sleep(1)
    def get_voltage(self):
        return self.ina260.get_bus_voltage()
    def get_current(self):
        return self.ina260.get_current()

plat = platform.uname().node
if plat == 'raspberrypi':
    from INA260_MINIMAL import INA260
    ina260 = RealINA260(0x40)
else:
    ina260 = DummyINA260()

if __name__ == '__main__':
    server = '192.168.1.156:3005'
    res = requests.get('http://' + server + '/lookup?role=LOGGER')
    if res.status_code != 200:
        print("error: " + res.status_code + " " + res.content)
    logger = res.content[3:].decode('UTF-8') # ignore the leading OK
    print('found logger at',logger)

    running = True
    try:
        while running:
            t = int(time.time() * 1000)
            v = ina260.get_voltage()
            i = ina260.get_current()
            res = requests.get('http://' + logger + '/log?t=' + str(t) + '&v=' + str(v) + '&i=' + str(i))
            if res.status_code != 200:
                print("error: " + res.status_code + " " + res.content)
            dt = datetime.now()
            time_to_sleep = 1.0 - (dt.microsecond * 0.000001)
            time.sleep(time_to_sleep)
    except KeyboardInterrupt:
        print("Run complete")
