// Linux 常用命令速查库（同时供命令解析器复用：TB.CMD_REF）
TB.CMD_REF = [
  // 文件与目录
  { name: 'ls', cat: '文件与目录', desc: '列出目录内容', example: 'ls -alh /var/log\nls -lh --sort=size' },
  { name: 'cd', cat: '文件与目录', desc: '切换当前目录', example: 'cd /opt/app\ncd ..' },
  { name: 'cp', cat: '文件与目录', desc: '复制文件/目录', example: 'cp -r src dst\ncp -p a.txt b.txt' },
  { name: 'mv', cat: '文件与目录', desc: '移动或重命名', example: 'mv a.txt b.txt\nmv dir/ /tmp/' },
  { name: 'rm', cat: '文件与目录', desc: '删除文件/目录（谨慎）', example: 'rm -rf old_dir\nrm -i *.log' },
  { name: 'mkdir', cat: '文件与目录', desc: '创建目录', example: 'mkdir -p a/b/c' },
  { name: 'find', cat: '文件与目录', desc: '按条件查找文件', example: 'find / -name "*.conf" 2>/dev/null\nfind . -mtime -1' },
  { name: 'ln', cat: '文件与目录', desc: '创建链接', example: 'ln -s /opt/app/app /usr/local/bin/app' },
  { name: 'rsync', cat: '文件与目录', desc: '增量同步文件', example: 'rsync -avz src/ user@host:/dst/\nrsync -av --delete a/ b/' },
  { name: 'tar', cat: '文件与目录', desc: '打包/解包', example: 'tar -czf pkg.tgz dir/\ntar -xzf pkg.tgz -C /tmp' },
  // 网络
  { name: 'ping', cat: '网络', desc: '测试连通性', example: 'ping -c 4 8.8.8.8' },
  { name: 'curl', cat: '网络', desc: 'HTTP 请求/下载', example: 'curl -s http://api/x\ncurl -X POST -d "a=1" url' },
  { name: 'wget', cat: '网络', desc: '下载文件', example: 'wget -c http://x/file.iso' },
  { name: 'ssh', cat: '网络', desc: '远程登录', example: 'ssh -p 22 user@host\nssh -L 8080:localhost:80 user@host' },
  { name: 'scp', cat: '网络', desc: '安全复制', example: 'scp file user@host:/path\nscp -r user@host:/etc ./' },
  { name: 'ss', cat: '网络', desc: '查看套接字（替代 netstat）', example: 'ss -tlnp\nss -uap' },
  { name: 'netstat', cat: '网络', desc: '网络统计（旧）', example: 'netstat -tulnp' },
  { name: 'ip', cat: '网络', desc: '网络配置', example: 'ip addr show\nip route' },
  // 系统信息
  { name: 'uname', cat: '系统信息', desc: '内核/系统信息', example: 'uname -a\nuname -r' },
  { name: 'top', cat: '系统信息', desc: '实时进程监控', example: 'top -d 1' },
  { name: 'htop', cat: '系统信息', desc: '增强版进程监控', example: 'htop' },
  { name: 'df', cat: '系统信息', desc: '磁盘空间', example: 'df -h' },
  { name: 'free', cat: '系统信息', desc: '内存使用', example: 'free -h' },
  { name: 'uptime', cat: '系统信息', desc: '系统运行时长/负载', example: 'uptime' },
  { name: 'date', cat: '系统信息', desc: '日期时间', example: 'date "+%Y-%m-%d %H:%M:%S"' },
  // 进程管理
  { name: 'ps', cat: '进程管理', desc: '查看进程', example: 'ps aux | grep nginx' },
  { name: 'kill', cat: '进程管理', desc: '发送信号终止进程', example: 'kill -9 1234\nkill -TERM 1234' },
  { name: 'pkill', cat: '进程管理', desc: '按名终止进程', example: 'pkill -f "python app.py"' },
  { name: 'nohup', cat: '进程管理', desc: '后台运行（忽略挂断）', example: 'nohup ./app > app.log 2>&1 &' },
  { name: 'crontab', cat: '进程管理', desc: '定时任务', example: 'crontab -e\n0 2 * * * /opt/backup.sh' },
  // 文本处理
  { name: 'grep', cat: '文本处理', desc: '文本搜索', example: 'grep -rn "error" /var/log\ngrep -i "warn" file' },
  { name: 'sed', cat: '文本处理', desc: '流编辑', example: "sed -i 's/old/new/g' file.txt" },
  { name: 'awk', cat: '文本处理', desc: '文本处理/统计', example: "awk '{sum+=$1} END{print sum}' data.txt" },
  { name: 'cat', cat: '文本处理', desc: '查看文件内容', example: 'cat -n file.txt' },
  { name: 'head', cat: '文本处理', desc: '查看开头', example: 'head -n 20 file.txt' },
  { name: 'tail', cat: '文本处理', desc: '查看末尾/实时', example: 'tail -f app.log' },
  { name: 'sort', cat: '文本处理', desc: '排序', example: 'sort -n -k2 data.txt' },
  { name: 'wc', cat: '文本处理', desc: '统计行/词/字符', example: 'wc -l file.txt' },
  { name: 'cut', cat: '文本处理', desc: '按列截取', example: 'cut -d, -f1,3 data.csv' },
  // 权限与磁盘
  { name: 'chmod', cat: '权限与磁盘', desc: '修改权限', example: 'chmod 755 script.sh\nchmod +x app' },
  { name: 'chown', cat: '权限与磁盘', desc: '修改属主', example: 'chown -R user:group /opt/app' },
  { name: 'du', cat: '权限与磁盘', desc: '目录占用', example: 'du -sh *' },
  { name: 'mount', cat: '权限与磁盘', desc: '挂载文件系统', example: 'mount /dev/sdb1 /mnt/data' },
  // 包管理
  { name: 'apt', cat: '包管理', desc: 'Debian/Ubuntu 包管理', example: 'apt update && apt install -y nginx' },
  { name: 'yum', cat: '包管理', desc: 'RHEL/CentOS 包管理', example: 'yum install -y vim' },
  { name: 'dpkg', cat: '包管理', desc: 'Debian 底层包管理', example: 'dpkg -i pkg.deb' },
  { name: 'rpm', cat: '包管理', desc: 'RPM 包管理', example: 'rpm -ivh pkg.rpm' }
];

TB.register({
  id: 'cmd-ref',
  name: '命令速查',
  category: 'Linux 命令',
  desc: '常用 Linux 命令分类速查：语法、说明、示例',
  render(c) {
    const search = TB.util.el('input', { type: 'search', class: '', placeholder: '搜索命令或说明…', style: 'width:100%' });
    const list = TB.util.el('div', {});
    const detail = TB.util.el('div', { class: 'pre', text: '点击上方命令查看详情' });

    function renderList(filter) {
      list.innerHTML = '';
      const f = (filter || '').trim().toLowerCase();
      const items = TB.CMD_REF.filter(x => !f || (x.name + ' ' + x.desc + ' ' + x.cat).toLowerCase().includes(f));
      if (!items.length) { list.appendChild(TB.util.el('div', { class: 'hint', text: '无匹配命令' })); return; }
      items.forEach(x => {
        const item = TB.util.el('div', { class: 'card', style: 'padding:10px 12px;cursor:pointer' }, [
          TB.util.el('div', { style: 'display:flex;justify-content:space-between;align-items:center' }, [
            TB.util.el('span', { class: 'mono', style: 'font-weight:600', text: x.name }),
            TB.util.el('span', { class: 'tag', text: x.cat })
          ]),
          TB.util.el('div', { class: 'hint', text: x.desc })
        ]);
        item.addEventListener('click', () => {
          detail.textContent = x.name + '  —  ' + x.cat + '\n\n说明：' + x.desc + '\n\n示例：\n' + x.example;
        });
        list.appendChild(item);
      });
    }
    search.addEventListener('input', () => renderList(search.value));
    renderList('');

    c.appendChild(TB.util.el('div', { class: 'card' }, [
      TB.util.el('h3', { text: 'Linux 命令速查' }), search,
      TB.util.el('div', { class: 'col', style: 'margin-top:10px' }, [list])
    ]));
    c.appendChild(TB.util.el('div', { class: 'card' }, [
      TB.util.el('h3', { text: '详情' }), detail
    ]));
  }
});
