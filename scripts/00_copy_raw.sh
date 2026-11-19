#!/usr/bin/env bash
# Copy source data from the manuscript package into data/raw/.
set -euo pipefail
ROOT=/mnt/n/08_DUC-XL-MS
PKG=$ROOT/Nature_manuscripts/Manuscript_579474_DUC-XL-MS
FIG5=$PKG/Shared_XL_MOPLC/XL_MOPLC/XL_complex_structure/src/figure5/data
RAW=$ROOT/Web_Visualization/data/raw

mkdir -p "$RAW/tables" "$RAW/sequences" "$RAW/structures"
cp -v "$PKG"/Supplementary_Tables/Supplementary_Table_*.xlsx "$RAW/tables/"
cp -v "$ROOT/data/LOP_DSBSO_target.fasta" "$RAW/sequences/"

for c in CORVET HOPS Exocyst; do
  mkdir -p "$RAW/structures/$c"
  cp -v "$FIG5/processed/$c/complex.pdb" "$FIG5/processed/$c/${c}_crosslink_distances.csv" \
        "$FIG5/raw/$c/chains.csv" "$RAW/structures/$c/"
done
mkdir -p "$RAW/structures/WASH"
cp -v "$FIG5/processed/WASH_v2_washc345/complex.pdb" "$RAW/structures/WASH/"
cp -v "$FIG5/processed/WASH_v2_washc345/WASH_v2_washc345_crosslink_distances.csv" "$RAW/structures/WASH/WASH_crosslink_distances.csv"
cp -v "$FIG5/raw/WASH_complex_v2/chains.csv" "$RAW/structures/WASH/"

# Experimental reference structures used for comparison in the paper
SN2=$PKG/Supplementary_Notes/Supplementary_Note_2/Code_and_Data/HOPS_CORVET_core
REF=$RAW/structures/reference
mkdir -p "$REF"
cp -v "$SN2/data/raw/7ZU0_hops.cif" "$REF/7ZU0.cif"            # yeast HOPS (Supplementary Note 2)
cp -v "$SN2/data/raw/8qx8_updated.cif" "$REF/8QX8.cif"         # yeast CORVET (Supplementary Note 2)
cp -v "$SN2/results/tables/table1_uniprot_identity.csv" "$SN2/results/tables/table_2a_corvet_core_rmsd.csv" \
      "$SN2/results/tables/table_2b_hops_core_rmsd.csv" "$REF/"
cp -v "$PKG/Main_Figures/Figure_4/Code_and_Data/src/figure3/results/RACK1_motif_contacts_6A.csv" "$REF/"
for id in 7X39 8GLP; do                                         # ERH·CIZ1 and 40S·RACK1 (Fig. 4E,F)
  [[ -s "$REF/$id.cif" ]] || curl -sSfL -o "$REF/$id.cif" "https://files.rcsb.org/download/$id.cif"
done

# Pinned UniProt release used by the paper (TRANSMEM / TOPO_DOM positions for topology diagrams)
UP=$RAW/sequences/uniprot_reviewed_human.tsv.gz
[[ -s "$UP" ]] || curl -sSfL -o "$UP" https://raw.githubusercontent.com/zhangzh-orange/DUC-XL-MS/main/data/raw/uniprot_reviewed_human.tsv.gz
