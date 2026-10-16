import { caution, fail, pass, type CheckDefinition } from "../check";
import { read } from "../snapshot";

// The pointer already parsed against NodePointerSchema (a repository whose
// pointer does not parse never reaches the checks: NODE_POINTER_INVALID).
// What remains is the cross fingerprint of spec §5.6.
export const nodePointerCheck: CheckDefinition = {
  id: "node-pointer",
  appliesWhen: () => true,
  run: (snapshot, params) => {
    const declared = params.pointer.standard;
    const forced = declared.version !== params.standard.version;
    const cached = params.standard.pointerVersionSha256;
    if (cached === undefined) {
      return caution([`standard ${declared.version} declared by forge614.node.json is not cached; this run used ${params.standard.version} (--standard)`], "nodePointerUnverifiable");
    }
    if (declared.sha256 !== cached) {
      return fail([`forge614.node.json standard.sha256 ${declared.sha256} vs cached standard-${declared.version}.tar.gz ${cached}`], "nodePointerMismatch");
    }
    if (params.pointer.node === "ai") {
      const standardVersion = read(snapshot, "standard/VERSION")?.trim();
      if (standardVersion !== undefined && standardVersion !== declared.version) {
        return fail([`standard/VERSION ${standardVersion} vs forge614.node.json ${declared.version}`], "nodePointerMismatch");
      }
    }
    const evidence = forced ? [`checked against standard ${params.standard.version} (--standard); forge614.node.json declares ${declared.version}`] : [];
    return pass("nodePointerOk", {}, evidence);
  },
};
