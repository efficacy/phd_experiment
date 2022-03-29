#!/usr/bin/python
import platform
import signal
import time
from datetime import datetime
import requests
import os

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

plat = platform.machine()
print('running on platform: ' + str(plat))
if plat.startswith('arm'):
    from INA260_MINIMAL import INA260
    ina260 = RealINA260(0x40)
    print('measuring using real INA260')
else:
    ina260 = DummyINA260()
    print('measuring using dummy INA260')

def run(logger):
    running = True
    try:
        while running:
            t = int(time.time() * 1000)
            v = ina260.get_voltage()
            i = ina260.get_current()
            url = logger + 'log?v=' + str(v) + '&i=' + str(i)
            print("send: " + url)
            res = requests.get(url)
            if res.status_code != 200:
                print("error: " + str(res.status_code) + " " + str(res.content))
            dt = datetime.now()
            time_to_sleep = 1.0 - (dt.microsecond * 0.000001)
            time.sleep(time_to_sleep)
    except KeyboardInterrupt:
        pass
    finally:
        print("Run complete")

if __name__ == '__main__':
    logger = os.getenv('LOGGER')
    if not logger:
        registry = os.getenv('REGISTRY')
        res = requests.get('http://' + registry + '/lookup?role=LOG')
        if res.status_code != 200:
            print("error: " + res.status_code + " " + res.content)
        logger = res.content[3:].decode('UTF-8') # ignore the leading OK
        # print("logger form registry:" + logger)
    else:
        # print("logger from environment:" + logger)
        if not logger.startswith("http"):
            logger = "http://" + logger + "/"
    # print('found logger at',logger)
    run(logger)
