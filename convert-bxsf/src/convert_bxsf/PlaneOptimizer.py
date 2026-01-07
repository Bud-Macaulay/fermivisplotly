import numpy as np


class PlaneOptimizer:
    def __init__(self, faces, planes, min_corner, max_corner, tol=1e-6):
        self.faces = list(faces)
        self.planes = list(planes)
        self.min_corner = np.asarray(min_corner)
        self.max_corner = np.asarray(max_corner)
        self.tol = tol

        xs = [self.min_corner[0], self.max_corner[0]]
        ys = [self.min_corner[1], self.max_corner[1]]
        zs = [self.min_corner[2], self.max_corner[2]]
        self.bbox_corners = np.array([[x, y, z] for x in xs for y in ys for z in zs])

    def deduplicate_planes(self):
        unique_planes = []
        unique_faces = []
        seen = []

        for face, plane in zip(self.faces, self.planes):
            normal = np.array(plane["normal"])
            D = plane["D"]

            duplicate = False
            for n0, D0 in seen:
                if np.allclose(normal, n0, atol=self.tol) and abs(D - D0) < self.tol:
                    duplicate = True
                    break

            if not duplicate:
                seen.append((normal, D))
                unique_planes.append(plane)
                unique_faces.append(face)

        self.faces = unique_faces
        self.planes = unique_planes

        return self.faces, self.planes

    def estimate_plane_clipping_impact(self, plane):
        normal = np.array(plane["normal"])
        D = plane["D"]

        dists = [np.dot(normal, c) - D for c in self.bbox_corners]

        if all(d <= 0 for d in dists):
            return 0

        return sum(max(0, d) for d in dists)

    def sort_by_impact(self):
        paired = []
        for face, plane in zip(self.faces, self.planes):
            impact = self.estimate_plane_clipping_impact(plane)
            paired.append((face, plane, impact))

        paired.sort(key=lambda x: x[2], reverse=True)

        self.faces = [p[0] for p in paired]
        self.planes = [p[1] for p in paired]

        return self.faces, self.planes
