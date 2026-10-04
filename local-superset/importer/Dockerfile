FROM goodwill-local/superset:4.1.1
WORKDIR /app
COPY import_snapshot.py /app/import_snapshot.py
COPY test_importer.py /app/test_importer.py
ENTRYPOINT ["python", "/app/import_snapshot.py"]