"""Bouw de station-pagina's op vanaf de testpagina's.

Gebruik:  python3 rollout.py <public-dir> [--check <orig_files_test> <orig_upload_test>]
"""
import re, sys, os

STATIONS = {
    "copy1": "COPY 1", "copy2": "COPY 2", "copy3": "COPY 3", "copy4": "COPY 4",
    "utrecht_copy1": "UTRECHT COPY 1", "utrecht_copy2": "UTRECHT COPY 2", "utrecht_copy3": "UTRECHT COPY 3",
    "hoogvliet_copy1": "HOOGVLIET COPY 1", "hoogvliet_copy2": "HOOGVLIET COPY 2",
}
TEST_BADGE = re.compile(r'^  <div class="fixed top-3 right-3 z-50[^\n]*>TEST MODE</div>\n', re.M)


def make(template, folder, label, kind):
    out = template.replace("TEST COPY 1", label).replace("test_copy1", folder)
    if kind == "files":
        out, n = TEST_BADGE.subn("", out)
        assert n == 1, "TEST MODE-label niet gevonden"
    assert "test_copy" not in out and "TEST COPY" not in out, folder
    return out


def main():
    public = sys.argv[1]
    if "--check" in sys.argv:
        i = sys.argv.index("--check")
        orig_files, orig_upload = open(sys.argv[i + 1]).read(), open(sys.argv[i + 2]).read()
        for folder, label in STATIONS.items():
            cur_upload = open(os.path.join(public, f"upload_{folder}.html")).read()
            gen_upload = make(orig_upload, folder, label, "upload")
            print(f"upload_{folder}: {'gelijk' if gen_upload == cur_upload else 'VERSCHIL'}")
            cur_files = open(os.path.join(public, f"files_{folder}.html")).read()
            gen_files = make(orig_files, folder, label, "files")
            # Verwacht verschil: alleen de TEST-resten die nu worden opgeruimd.
            expected = TEST_BADGE.sub("", cur_files).replace("TEST " + label, label)
            print(f"files_{folder}:  {'gelijk (op TEST-resten na)' if gen_files == expected else 'VERSCHIL'}")
        return

    files_tpl = open(os.path.join(public, "files_test_copy1.html")).read()
    upload_tpl = open(os.path.join(public, "upload_test_copy1.html")).read()
    for folder, label in STATIONS.items():
        for kind, tpl in (("files", files_tpl), ("upload", upload_tpl)):
            path = os.path.join(public, f"{kind}_{folder}.html")
            with open(path, "w", encoding="utf-8") as fh:
                fh.write(make(tpl, folder, label, kind))
            print("bijgewerkt:", os.path.basename(path))


main()
