/**
 * Category helpers for selects that must resolve to a *leaf* category.
 *
 * The catalogue is a two-level tree: broad parents (e.g. "Home Services") used
 * for browsing, and leaves (e.g. "Plumbing") that actually own the services.
 * Services and search filters are keyed on the leaf, so a select fed straight
 * from `categoriesApi.tree()` offers parents and resolves to nothing at all.
 */

export type CategoryNode = {
  id: string;
  name: string;
  children?: CategoryNode[] | null;
};

export type CategoryGroup = {
  group: string;
  options: { id: string; name: string }[];
};

function leavesOf(node: CategoryNode, trail: string[], out: CategoryNode[]) {
  const children = node.children ?? [];
  if (children.length === 0) {
    out.push(node);
    return;
  }
  for (const child of children) leavesOf(child, trail, out);
}

/**
 * Flattens the category tree into the leaves, keeping the tree's order and the
 * top-level parent each leaf belongs to. A root that is itself a leaf (no
 * children) is returned on its own so nothing silently disappears.
 */
export function categoryGroups(tree: CategoryNode[] | null | undefined): CategoryGroup[] {
  const groups: CategoryGroup[] = [];

  for (const root of tree ?? []) {
    const leaves: CategoryNode[] = [];
    leavesOf(root, [root.name], leaves);

    if (leaves.length === 1 && leaves[0].id === root.id) {
      groups.push({ group: root.name, options: [{ id: root.id, name: root.name }] });
      continue;
    }
    groups.push({
      group: root.name,
      options: leaves.map((leaf) => ({ id: leaf.id, name: leaf.name })),
    });
  }

  return groups.filter((g) => g.options.length > 0);
}

/** Every leaf category as a flat list, for callers that don't group. */
export function leafCategories(tree: CategoryNode[] | null | undefined): { id: string; name: string }[] {
  return categoryGroups(tree).flatMap((g) => g.options);
}
