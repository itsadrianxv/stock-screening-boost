Place vendor-provided Linux packages for iFinD here when you need full iFinD support in Docker.

Supported package formats:

- `*.whl`
- `*.tar.gz`
- `*.zip`

The Docker build copies this directory into the image and installs any matching package files.
If this directory only contains this README, the Python service still builds and falls back to
AkShare when iFinD is unavailable.
