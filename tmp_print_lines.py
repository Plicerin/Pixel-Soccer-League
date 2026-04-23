path = 'telemetry-batches.ndjson'
lines_to_print = set(range(2148, 2164))
with open(path, 'r', encoding='utf-8') as f:
    for i, line in enumerate(f, start=1):
        if i in lines_to_print:
            print(i, line.strip())
        if i > max(lines_to_print):
            break
