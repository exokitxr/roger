# roger
Reality projection server for Magic Leap

This is a hub server for reality projection using [Magic Leap](https://magicleap.com) and [Exokit](https://github.com/webmixedreality/exokit).

Roger lets you project a layer or real reality (meshes and textures) to a multiplayer world on the web. It also supports WebXR, for projecting the real reality to a fake reality in VR/AR.

### Usage

Run Exokit on your Magic Leap, assuming `roger` is running on `1.2.3.4`:

```
./scripts/run-ml.sh /package/examples/realityprojection_ml.html?s=http://1.2.3.4:8001
```

Clients can connect to the multiplayer world by visiting `http://1.2.3.4:8001` on any browser. WebXR is supported.
