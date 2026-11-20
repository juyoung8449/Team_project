function createBamboo(THREE) {
  const length = 3.5;
  const radius = 0.044;
  const start = -length / 2;
  const end = length / 2;
  const curve = new THREE.LineCurve3(
    new THREE.Vector3(start, 0, 0),
    new THREE.Vector3(end, 0, 0)
  );
  const material = new THREE.MeshStandardMaterial({
    color: 0xc69b69,
    roughness: 0.52,
    metalness: 0.02
  });
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 64, radius, 16, false),
    material
  );
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const ends = [start, end].map((x) => {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 12), material);
    cap.position.x = x;
    cap.castShadow = true;
    group.add(cap);
    return cap;
  });

  return { group, body, ends, length, radius };
}
