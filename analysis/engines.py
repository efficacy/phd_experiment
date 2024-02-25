import sys
from itertools import accumulate
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
import psycopg2 as pg

dummy = False

runs = {
  ('Lighttpd', 'Static'): [
    ('S1107', '1'),
    ('S1107', '2'),
    ],
  ('Lighttpd', 'Solomon'): [
    ('S1107', '3'),
    ('S1107', '4'),
  ],
  ('Lighttpd', 'Freemarker'): [
    ('S1107', '3'),
    ('S1107', '4'),
    ],
  ('Lighttpd', 'Jangod'): [
    ('S1107', '7'),
    ('S1107', '8'),
    ],
  ('Lighttpd', 'GILT Native'): [
    ('S1108', '1'),
    ('S1108', '2'),
    ],
  ('Lighttpd', 'Pebble'): [
    ('S1108', '3'),
    ('S1108', '4'),
  ],
  ('Lighttpd', 'Stringtree'): [
    ('S1108', '5'),
    ('S1108', '6'),
    ],
  ('Lighttpd', 'Trimou'): [
    ('S1108', '7'),
    ('S1108', '8'),
  ],
  ('Lighttpd', 'Velocity'): [
    ('S1108', '9'),
    ('S1108', '10'),
  ],
  ('Lighttpd', 'Handlebars'): [
    ('S1108', '11'),
    ('S1108', '12'),
  ],
}

def round6(n):
  return '{:g}'.format(float('{:.6g}'.format(n)))

def normalise_name(scenario, session):
  return scenario + "_" + session

def crunch(con, name):
  return 0, 0, 0, 0, 0

def ensure_subtable(con, scenario, session):
  # make a copy of the active data from this test
  name = normalise_name(scenario, session)
  cur = con.cursor()
  cur.execute("create table if not exists " + name + " as select scenario, session, t, v, i, v*i as p from session2, log where t >= start and t < stop and scenario='" + scenario + "' and session='" + session + "'")
  con.commit()
  # print("# Created test table")

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
  ensure_subtable(con, scenario, session)
  bl_total, bl_mean = calculate_baseline(con, scenario, session)
  act_total, act_mean, n, x, y = calculate_active(con, scenario, session)
  run_total = bl_total + act_total
  extra = act_total - (bl_mean * n)
  return extra, x, y, bl_mean, act_mean, act_total, run_total

def generate_dummy():
  return [ ('Wordpress', 'Apache'), ('Wordpress', 'Lightpd'), ('Static', 'Apache'), ('Static', 'Nginx'), ('Static', 'Java') ], \
    [ 40, 18, 1, 3, 4 ], \
    [ 260, 223, 15, 15, 19 ], \
    [ 50, 57, 1, 2, 6 ]

def plot():
  labels = []
  mins = []
  means = []
  maxes = []

  if dummy:
    labels, mins, means, maxes = generate_dummy()
  else:
    # con = pg.connect(database="experiments", user="logger", password="logger", host="192.168.0.187", port="5432")
    con = pg.connect(database="experiments", user="logger", password="logger", host="localhost", port="5432")
    print("# Database opened successfully")

    labels = []
    mins = []
    means = []
    maxes = []
    for key in runs:
      labels.append(key)
      sessions = runs[key]
      # print('samples for ' + key)
      values = []
      for run in sessions:
        scenario, session = run
        # print(" considering " + scenario + "/" + session)
        usage, x, y, bl_mean, act_mean, act_total, run_total = calculate(con, scenario, session)
        print('  (' + scenario + '/' + session + '): ' + str(round6(usage)) )
        values.append(usage)
      min = np.min(values)
      max = np.max(values)
      mean = np.mean(values)
      print(' min: ' + str(min) + ' mean:' + str(mean) + ' max: ' + str(max))
      mins.append(mean-min)
      maxes.append(max-min)
      means.append(mean)


  colors = { 'Wordpress' : 'red', 'Static' : 'green'}

  sep = 0
  topvalue= 0
  types = []
  values = { \
    'Wordpress' : {'label': [], 'min': [], 'max': [], 'mean': [] }, \
    'Static': {'label': [], 'min': [], 'max': [], 'mean': [] } \
    }
  for i, label in enumerate(labels):
    print("label",label)
    group, type = label
    types.append(type)
    values[group]['label'].append(type)
    values[group]['min'].append(mins[i])
    values[group]['mean'].append(means[i])
    values[group]['max'].append(maxes[i])
    if group == 'Static' and sep == 0:
      sep = i - 0.5
  for i, mean in enumerate(means):
    bar = mean + maxes[i]
    if bar > topvalue:
      topvalue = bar

  ratios = [1, 1]

  fig = plt.figure()
  gs = fig.add_gridspec(1, 2, wspace=0, width_ratios=ratios)
  axes = gs.subplots(sharex=False, sharey=True)

  width = 0.4

  for i, group in enumerate(values):
    data = values[group]
    xlabels = data['label']
    ratios[i] = len(xlabels)
    # print("group:", i, group)
    # print(" labels:", data['label'])
    # print(" mins:", data['min'])
    # print(" means:", data['mean'])
    # print(" maxes:", data['max'])
    errors = np.array( [ data['min'], data['max'] ] )
    # print(" errors:", errors)

    ax = axes[i]
    ax.set_xticks( range( len(xlabels) ) )
    ax.set_xticklabels( xlabels, rotation=75, ha='right' )
    ax.errorbar( np.arange(len(xlabels)), data['mean'], yerr=errors, c=colors[group], fmt='.', capsize=4)
    ax.set_title(group)
    ax.grid(axis='y', linestyle=':', color='#DDDDDD')
    ax.label_outer()
    margin = (1 - width) + width / 2
    ax.set_xlim(-margin, len(xlabels) - 1 + margin)

  axes[0].set_ylabel('Energy (Joules)')

  # ax.axvline(x=sep)
  # ax.text(0, topvalue / 2, 'Wordpress', fontsize=14, color='r')
  # ax.text(sep + 0.1, topvalue / 2, 'Static',  fontsize=14, color='r')


  fig.suptitle('Energy Usage by Scenario', fontweight ="bold")
  fig.tight_layout()
  plt.show()

for arg in sys.argv:
  if arg == '-d':
    dummy = True
plot()