function getBambooCutPosition(length) {
  return length / 2 - length / 12;
}

function createBambooBodyGeometry(THREE, start, end, radius) {
  return new THREE.TubeGeometry(
    new THREE.LineCurve3(
      new THREE.Vector3(start, 0, 0),
      new THREE.Vector3(end, 0, 0)
    ),
    64, radius, 16, false
  );
}

function createBambooCutFaceMaterial(THREE) {
  return new THREE.MeshStandardMaterial({
    color: 0xc5ad78,
    roughness: 0.78,
    metalness: 0
  });
}

function createBambooCutFace(THREE, radius, material, x) {
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, 0.018, 24),
    material
  );
  cap.position.x = x;
  cap.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(1, 0, 0)
  );
  return cap;
}

function createBamboo(THREE, { cut = false } = {}) {
  const length = 3.5;
  const radius = 0.044;
  const end = cut ? getBambooCutPosition(length) : length / 2;
  const start = -end;
  const material = new THREE.MeshStandardMaterial({
    color: 0xc69b69,
    roughness: 0.52,
    metalness: 0.02
  });
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    createBambooBodyGeometry(THREE, start, end, radius),
    material
  );
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const cutFaceMaterial = cut ? createBambooCutFaceMaterial(THREE) : null;
  const ends = [start, end].map((x) => {
    const cap = cut
      ? createBambooCutFace(THREE, radius, cutFaceMaterial, x)
      : new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 12), material);
    if (!cut) {
      cap.position.x = x;
      cap.castShadow = true;
    }
    group.add(cap);
    return cap;
  });

  return { group, body, ends, length, radius, start, end };
}
