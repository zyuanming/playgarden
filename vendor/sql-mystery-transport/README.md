# Exact archive transport

These local parts reassemble the unmodified SQL Mystery source bundle and the official SQLite canonical source ZIP. Each part and complete archive is SHA256 bound in manifest.json. Run python3 scripts/materialize-sql-mystery-archives.py before the normal source verifier/build. No network or executable archive extraction is used.

The public downloadable source.zip contains the complete, already assembled original data, runtime, preferred engine sources, full notices and own game source. This Git-only materializer is unnecessary for that already assembled bundle. Its readable GPL-3.0-only source is also provided in this repository.
