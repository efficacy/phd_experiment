#!/bin/bash
ps aux |grep node | awk '
/logger\.js/ { system("kill " $2); print "killed logger " $2}
/registry\.js/ { system("kill " $2); print "killed registry " $2}
'
