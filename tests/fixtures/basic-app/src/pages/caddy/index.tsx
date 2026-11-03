import React from "react";
import {ServerOnly, ServerElement} from "@bouygues-telecom/staticjs/server-only";

export default function Caddy() {
    return (
        <>
            <p data-testid="greeting">
                Hello <ServerOnly>{'{{ .Req.Header.Get "X-Name" }}'}</ServerOnly>!
            </p>
            <ServerElement as="h2" id="caddy-title">{'{{ include "/fragment.html" }}'}</ServerElement>
            <p data-testid="escaped">{'"quoted" & <tag>'}</p>
        </>
    );
}
