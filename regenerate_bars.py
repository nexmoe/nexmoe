import json
import os

# 读取数据
with open('github_overview.json', 'r') as f:
    data = json.load(f)

# 获取所有仓库数据
repos = data['scopes']['merged']['repos']

# 找到最大星数
max_stars = max(repo['stargazers_count'] for repo in repos)

# 生成 SVG
for repo in repos:
    stars = repo['stargazers_count']

    # 只生成 100+ stars 的
    if stars < 100:
        continue

    # 计算百分比
    percent = (stars / max_stars) * 100

    # 计算填充宽度
    fill_width = 600 * percent / 100

    # 格式化星数（添加逗号）
    stars_formatted = f"{stars:,}"

    # 生成文件名
    repo_name = repo['full_name'].lower().replace('/', '-')
    filename = f"assets/repository-bars/{repo_name}.svg"

    # 生成 SVG 内容
    svg_content = f'''<svg xmlns="http://www.w3.org/2000/svg" width="600" height="32" viewBox="0 0 600 32" role="img" aria-label="{stars_formatted} stars">
<title>{stars_formatted} stars · {percent:.1f}% of the top repository</title>
<style>
  .count{{fill:#1d1d1f;font:600 15px -apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif}}
  .track{{fill:#f0f0f5}}.fill{{fill:#007aff}}
  @media (prefers-color-scheme:dark){{.count{{fill:#f5f5f7}}.track{{fill:#2c2c2e}}}}
</style>
<text class="count" x="0" y="14">{stars_formatted}</text>
<rect class="track" y="22" width="600" height="8" rx="4"/>
<rect class="fill" y="22" width="{fill_width:.2f}" height="8" rx="4"/>
</svg>
'''

    # 写入文件
    with open(filename, 'w') as f:
        f.write(svg_content)

    print(f"Generated {filename}: {stars_formatted} stars ({percent:.1f}%)")

print(f"\nTotal generated: {sum(1 for r in repos if r['stargazers_count'] >= 100)} files")
