import sys
from itertools import accumulate
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
import psycopg2 as pg

import comp_runs as runs

def normalise_name(scenario, session):
  return scenario + "_" + session

def calculate_baseline(con, scenario, session):
  # determine the average and total baseline power usage
  cur = con.cursor()
  cur.execute("select v*i as p from session2, log where t >= base_start and t < base_stop and scenario='" + scenario + "' and session='" + session + "'")
  rows = cur.fetchall()
  # print("fetched " + str(len(rows)) + " baseline measurements")

  baseline = []

  for row in rows:
    p = row[0]
    baseline.append(p)

  bl_total = np.sum(baseline)
  bl_mean = np.mean(baseline)

  return bl_total, bl_mean

def calculate_active(con, scenario, session):
  # process the active data
  name = normalise_name(scenario, session)
  cur = con.cursor()
  cur.execute("select t,p from " + name + " order by t")
  rows = cur.fetchall()

  x = []
  y = []

  active = []

  if len(rows) == 0:
    raise RuntimeError("no data to analyse")

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
  return act_total, act_mean, len(active), x, y

def calculate(con, scenario, session):
  bl_total, bl_mean = calculate_baseline(con, scenario, session)
  act_total, act_mean, n, x, y = calculate_active(con, scenario, session)
  run_total = bl_total + act_total
  extra = act_total - (bl_mean * n)
  return extra, x, y, bl_mean, act_mean, act_total, run_total

def round6(n):
  return '{:g}'.format(float('{:.6g}'.format(n)))

def plot(values, ylabel='Energy (Joules)'):
  # print("plotting", values)
  labels = []
  downs = []
  means = []
  ups = []

  for i, run in enumerate(values):
    # print("examining run", run)
    labels.append(run['engine'])
    means.append(run['mean'])
    downs.append(run['mean'] - run['min'])
    ups.append(run['max'] - run['mean'])

  print("downs:  " + str(downs))
  print("means: " + str(means))
  print("ups: " + str(ups))

  errors = np.array([downs, ups])

  fig = plt.figure()

  width = 0.4

  ax = fig.add_subplot(111)
  ax.set_xticks( range( len(labels) ) )
  ax.set_xticklabels( labels, rotation=75, ha='right' )
  ax.errorbar( np.arange(len(labels)), means, yerr=errors, fmt='.', capsize=4)
  ax.grid(axis='y', linestyle=':', color='#DDDDDD')
  ax.label_outer()
  margin = (1 - width) + width / 2
  ax.set_xlim(-margin, len(labels) - 1 + margin)

  ax.set_ylabel(ylabel)

  # ax.axvline(x=sep)
  # ax.text(0, topvalue / 2, 'Wordpress', fontsize=14, color='r')
  # ax.text(sep + 0.1, topvalue / 2, 'Static',  fontsize=14, color='r')


  # fig.suptitle('Energy Usage by Scenario', fontweight ="bold")
  fig.tight_layout()
  plt.show()


dummy = False
runs = runs.data()

con = pg.connect(database="experiments", user="logger", password="logger", host="192.168.0.187", port="5432")
print("# Database opened successfully")

energy_values = []
duration_values = []
ratio_values = []

for engine in runs:
  ids = runs[engine]
  # print(f'engine: {engine}')
  n = 0

  total_energy = 0
  lowest_energy = 10000
  highest_energy = -10000

  total_duration = 0
  lowest_duration = 10000
  highest_duration = -10000

  total_ratio = 0
  lowest_ratio = 10000
  highest_ratio = -10000

  for id in ids:
    scenario, session = id
    # print(f'session: {scenario}, run {session}')
    usage, x, y, bl_mean, act_mean, act_total, run_total = calculate(con, scenario, session)
    print(f'({scenario}/{session}) usage={round6(usage)} time={max(x)}')
    duration = max(x)
    ratio = usage / duration

    total_energy += usage
    total_duration += duration
    total_ratio += ratio
    n += 1

    if (usage < lowest_energy):
      lowest_energy = usage
    if (usage > highest_energy):
      highest_energy = usage

    if (duration < lowest_duration):
      lowest_duration = duration
    if (duration > highest_duration):
      highest_duration = duration

    if (ratio < lowest_ratio):
      lowest_ratio = ratio
    if (ratio > highest_ratio):
      highest_ratio = ratio

  mean_energy = total_energy / n
  mean_duration = total_duration / n
  mean_ratio = total_ratio / n
  # print(f'engine: {engine} mean: {round6(mean_energy)} min: {round6(lowest_energy)} max: {round6(highest_energy)}')
  energy_values.append({'engine': engine, 'mean': mean_energy, 'min': lowest_energy, 'max': highest_energy})
  print(f'engine: {engine} mean: {round6(mean_duration)} min: {round6(lowest_duration)} max: {round6(highest_duration)}')
  duration_values.append({'engine': engine, 'mean': mean_duration, 'min': lowest_duration, 'max': highest_duration})
  ratio_values.append({'engine': engine, 'mean': mean_ratio, 'min': lowest_ratio, 'max': highest_ratio})

# plot(energy_values)
# plot(duration_values)
plot(ratio_values, ylabel='Power (Watts)')
