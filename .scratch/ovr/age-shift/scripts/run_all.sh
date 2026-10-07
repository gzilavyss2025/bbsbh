#!/bin/bash
# Order: fetch CSVs, birth dates, then analysis. Run from anywhere. Needs python3 + numpy.
D=$(dirname "$0"); bash $D/fetch.sh; python3 -I $D/birth.py
for s in step2 step3 step3b step5 step5b step4_tables step_agedef; do python3 -I $D/$s.py > $D/../log_$s.txt; done
