import os
import requests
import socket
from datetime import datetime, timezone
import time

registry = "<%=it.registry%>"
role = "<%=it.role%>"
if role == "":
  role = os.getenv('ROLE')

def get_ip():
  host, port = registry.split(':')
  print ("host=" + host)
  print ("port=" + port)
  s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
  s.connect((host, int(port)))
  address = s.getsockname()[0]
  s.close()
  return address

if __name__ == '__main__':
  myip = get_ip()
  print("got ip " + myip)
  url = "http://"+registry + "/register?role=" + role + "&address=http://" + myip + ":8000"

  while True:
    print('Register with:',registry,'role:',role,'address:',myip)
    r = requests.get(url)
    if r.status_code == 200:
        expiry = int(r.headers['X-lease-expiry'][:19])
        now = int(time.time() * 1000.0)
        print("now=" + str(now) + " expiry=" + str(expiry))
        ms = expiry - now
        s = (ms // 1000) - 1
        print("need to sleep for " + str(s) + " seconds")
        time.sleep(s)
