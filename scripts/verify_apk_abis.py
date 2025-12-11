#!/usr/bin/env python3
"""
verify_apk_abis.py

Simple verifier that inspects all .so files under a directory that mirrors an APK's lib/<abi>/ layout
and ensures the ELF e_machine matches the ABI implied by the directory name.

Usage:
  python scripts/verify_apk_abis.py <path-to-lib-dir>

Exit codes:
  0 - all files match
  2 - mismatch found (non-zero to fail builds)

This script intentionally avoids extra dependencies and reads ELF headers directly.
"""
import os
import sys
import struct

# Mapping of ABI directory name -> expected ELF e_machine
ABI_TO_EM = {
    'arm64-v8a': 183,   # EM_AARCH64
    'armeabi-v7a': 40,  # EM_ARM
    'x86': 3,           # EM_386
    'x86_64': 62,       # EM_X86_64
}


def read_elf_em(path):
    with open(path, 'rb') as f:
        ident = f.read(20)
        if len(ident) < 20 or ident[0:4] != b'\x7fELF':
            return None
        ei_class = ident[4]
        # e_machine is at offset 18 (2 bytes) in both ELF32 and ELF64
        f.seek(18)
        em_bytes = f.read(2)
        if len(em_bytes) < 2:
            return None
        # little-endian for Android ELF files
        e_machine = struct.unpack('<H', em_bytes)[0]
        return (ei_class, e_machine)


def main():
    if len(sys.argv) != 2:
        print('Usage: verify_apk_abis.py <path-to-lib-dir>')
        return 1

    lib_root = sys.argv[1]
    if not os.path.isdir(lib_root):
        print('Path is not a directory:', lib_root)
        return 1

    mismatches = []
    for root, dirs, files in os.walk(lib_root):
        for fn in files:
            if not fn.endswith('.so'):
                continue
            full = os.path.join(root, fn)
            # Expect path like .../lib/<abi>/name.so or .../<abi>/name.so
            parts = os.path.normpath(full).split(os.path.sep)
            # find abi segment among known ABI names
            abi = None
            for p in parts[::-1]:
                if p in ABI_TO_EM:
                    abi = p
                    break
            if abi is None:
                # skip files not in ABI dirs
                continue
            em_info = read_elf_em(full)
            if em_info is None:
                mismatches.append((full, abi, 'not-elf'))
                print(f'MISMATCH: {full} -> expected {abi} but not a valid ELF')
                continue
            ei_class, e_machine = em_info
            expected = ABI_TO_EM[abi]
            if e_machine != expected:
                mismatches.append((full, abi, e_machine))
                print(f'MISMATCH: {full} -> expected e_machine={expected} for {abi}, found {e_machine}')

    if mismatches:
        print('\nABI verification failed: found', len(mismatches), 'mismatches')
        return 2

    print('ABI verification passed: all packaged .so files match their ABI directories')
    return 0


if __name__ == '__main__':
    sys.exit(main())
