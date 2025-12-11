#!/usr/bin/env python3
import sys
import os

EM_MAP = {
    0: 'EM_NONE',
    2: 'EM_SPARC',
    3: 'EM_386',
    40: 'EM_ARM',
    62: 'EM_X86_64',
    183: 'EM_AARCH64',
}


def read_em(file_path):
    try:
        with open(file_path, 'rb') as f:
            data = f.read(20)
            if len(data) < 20 or data[0:4] != b'\x7fELF':
                return None
            # e_ident[4] is class: 1 = 32-bit, 2 = 64-bit
            ei_class = data[4]
            # e_machine is at offset 18 (little-endian)
            e_machine = int.from_bytes(data[18:20], 'little')
            return ei_class, e_machine
    except Exception as e:
        return f'ERR:{e}'


def arch_name(e_machine):
    return EM_MAP.get(e_machine, f'EM_{e_machine}')


def scan(path):
    results = []
    for root, dirs, files in os.walk(path):
        for fn in files:
            if not fn.endswith('.so'):
                continue
            p = os.path.join(root, fn)
            info = read_em(p)
            if info is None:
                results.append((p, 'NOT_ELF'))
            elif isinstance(info, tuple):
                ei_class, e_machine = info
                cls = '32-bit' if ei_class == 1 else '64-bit' if ei_class == 2 else f'CLASS_{ei_class}'
                results.append((p, cls, e_machine, arch_name(e_machine)))
            else:
                results.append((p, str(info)))
    return results


if __name__ == '__main__':
    root = sys.argv[1] if len(sys.argv) > 1 else '.'
    res = scan(root)
    if not res:
        print('No .so files found under', root)
        sys.exit(0)
    for r in res:
        if len(r) == 2:
            print(r[0], r[1])
        else:
            print(r[0], r[1], r[2], r[3])

