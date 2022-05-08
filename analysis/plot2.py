import sys
from itertools import accumulate
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
import psycopg2 as pg

def round6(n):
  return '{:g}'.format(float('{:.6g}'.format(n)))

def normalise_name(scenario, session):
  return scenario + "_" + session

def plot(scenario, session):
  name = normalise_name(scenario, session)
  con = pg.connect(database="experiments", user="logger", password="logger", host="192.168.0.187", port="5432")
  print("# Database opened successfully")

  # make a copy of the active data from this test
  cur = con.cursor()
  cur.execute("create table if not exists " + name + " as select scenario, session, t, v, i, v*i as p from session2, log where t >= start and t < stop and scenario='" + scenario + "' and session='" + session + "'")
  con.commit()
  print("# Created test table")

  # determine the average and total baseline power usage
  cur = con.cursor()
  cur.execute("select v*i as p from session2, log where t >= base_start and t < base_stop and scenario='" + scenario + "' and session='" + session + "'")
  rows = cur.fetchall()
  print("fetched " + str(len(rows)) + "baseline measurements")

  baseline = []

  for row in rows:
    p = row[0]
    baseline.append(p)

  bl_total = np.sum(baseline)
  bl_mean = np.mean(baseline)


  # process the active data
  cur = con.cursor()
  cur.execute("select t,p from " + name + " order by t")
  rows = cur.fetchall()

  x = []
  y = []

  active = []

  if len(rows) > 0:
    first = rows[0][0]

    for row in rows:
      t = row[0]
      last = t
      dt = (t - first).total_seconds()
      p = row[1]
      x.append(dt)
      y.append(p)
      active.append(p)

    act_total = np.sum(active)
    act_mean = np.mean(active)
    extra = act_total - (bl_mean * len(active))

    print('total energy used during run: ' + str(round6(bl_total + act_total)) + " J")
    print('baseline mean power usage: ' + str(round6(bl_mean)) + " W")
    print('total energy used during active session: ' + str(round6(act_total)) + " J")
    print('active mean power usage: ' + str(round6(act_mean)) + " W")
    print('extra energy used during active session: ' + str(round6(extra)) + " J")

    fig,ax = plt.subplots(1)

    ax.plot(x, y)

    ax.set_xlabel('time (s)')

    ax.set_ylabel('power (W)')

    ax.set_title(scenario + " / " + session + " (" + first.strftime('%Y-%m-%d') + ")")
    plt.show()
  else:
    print('no rows in database for ' + scenario + '/' + session)

if len(sys.argv) > 1:
  print('args:' + str(sys.argv))
  plot(sys.argv[1], sys.argv[2])
else:
  plot('static', '2')