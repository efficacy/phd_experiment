#!/bin/bash
(cd shared; npm i)
(cd registry; npm i)
(cd logger; npm i)
# (cd panel; npm i)
(cd tests; npm i; npm test)