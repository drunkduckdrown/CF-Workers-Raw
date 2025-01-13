export default {
    async fetch(request, env) {
        // 只缓存 GET 请求
        if (request.method !== 'GET') {
            return new Response('Method not allowed', { status: 405 });
        }

        const url = new URL(request.url);
        url.pathname = url.pathname.replace(/^\/myimg/, '');
        
        if (url.pathname === '/') {
            return handleHomePage(request, env);
        }

        // 获取 GitHub raw URL 和 token
        const { githubRawUrl, githubToken } = await prepareGithubRequest(url, env);
        
        if (!githubToken) {
            return new Response('TOKEN不能为空', { status: 400 });
        }

        // 尝试从缓存获取响应
        const cacheKey = new Request(githubRawUrl, {
            method: 'GET',
            headers: new Headers({
                'Accept': 'application/json,text/plain,*/*',
            })
        });

        const cache = caches.default;
        let response = await cache.match(cacheKey);

        if (!response) {
            // 如果没有缓存，发起新请求
            const headers = new Headers({
                'Authorization': `token ${githubToken}`,
                'Accept': 'application/json,text/plain,*/*'
            });

            response = await fetch(githubRawUrl, { headers });

            if (response.ok) {
                // 创建可缓存的响应
                const newHeaders = new Headers(response.headers);
                // 设置缓存时间为 30 天
                newHeaders.set('Cache-Control', 'public, s-maxage=2592000');
                newHeaders.set('CDN-Cache-Control', 'max-age=2592000');
                // 删除可能影响缓存的头
                newHeaders.delete('Set-Cookie');
                newHeaders.delete('Pragma');
                newHeaders.delete('Expires');

                const cacheableResponse = new Response(response.body, {
                    status: response.status,
                    headers: newHeaders
                });

                // 直接存储到缓存，不使用 waitUntil
                try {
                    await cache.put(cacheKey, cacheableResponse.clone());
                } catch (e) {
                    console.error('Cache put failed:', e);
                }
                
                return cacheableResponse;
            } else {
                const errorText = env.ERROR || '无法获取文件，检查路径或TOKEN是否正确。';
                return new Response(errorText, { status: response.status });
            }
        }

        return response;
    }
};

// 处理首页请求的函数
async function handleHomePage(request, env) {
    const envKey = env.URL302 ? 'URL302' : (env.URL ? 'URL' : null);
    if (envKey) {
        const URLs = await ADD(env[envKey]);
        const URL = URLs[Math.floor(Math.random() * URLs.length)];
        return envKey === 'URL302' ? Response.redirect(URL, 302) : fetch(new Request(URL, request));
    }
    return new Response(await nginx(), {
        headers: {
            'Content-Type': 'text/html; charset=UTF-8',
        },
    });
}

// 准备 GitHub 请求的函数
async function prepareGithubRequest(url, env) {
    let githubRawUrl = 'https://raw.githubusercontent.com';
    if (new RegExp(githubRawUrl, 'i').test(url.pathname)) {
        githubRawUrl += url.pathname.split(githubRawUrl)[1];
    } else {
        if (env.GH_NAME) {
            githubRawUrl += '/' + env.GH_NAME;
            if (env.GH_REPO) {
                githubRawUrl += '/' + env.GH_REPO;
                if (env.GH_BRANCH) githubRawUrl += '/' + env.GH_BRANCH;
            }
        }
        githubRawUrl += url.pathname;
    }

    let token = "";
    if (env.GH_TOKEN && env.TOKEN) {
        if (env.TOKEN == url.searchParams.get('token')) token = env.GH_TOKEN || token;
        else token = url.searchParams.get('token') || token;
    } else {
        token = url.searchParams.get('token') || env.GH_TOKEN || env.TOKEN || token;
    }

    return { githubRawUrl, githubToken: token };
}

// 其他函数保持不变
async function nginx() {
    const text = `
    <!DOCTYPE html>
    <html>
    <head>
    <title>Welcome to nginx!</title>
    <style>
        body {
            width: 35em;
            margin: 0 auto;
            font-family: Tahoma, Verdana, Arial, sans-serif;
        }
    </style>
    </head>
    <body>
    <h1>Welcome to nginx!</h1>
    <p>If you see this page, the nginx web server is successfully installed and
    working. Further configuration is required.</p>
    
    <p>For online documentation and support please refer to
    <a href="http://nginx.org/">nginx.org</a>.
    Commercial support is available at
    <a href="http://nginx.com/">nginx.com</a>.</p>
    
    <p><em>Thank you for using nginx.</em></p>
    </body>
    </html>
    `
    return text ;
}
async function ADD(envadd) {
    var addtext = envadd.replace(/[	|"'\r\n]+/g, ',').replace(/,+/g, ',');	// 将空格、双引号、单引号和换行符替换为逗号
    //console.log(addtext);
    if (addtext.charAt(0) == ',') addtext = addtext.slice(1);
    if (addtext.charAt(addtext.length -1) == ',') addtext = addtext.slice(0, addtext.length - 1);
    const add = addtext.split(',');
    //console.log(add);
    return add ;
}
