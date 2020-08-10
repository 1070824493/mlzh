<?php
/*
 * 功能：产品模块－默认首页
 * Author:资料空白
 * Date:20180509
 */
class HelpController extends ProductBasicController
{
	private $m_help;

    public function init()
    {
        parent::init();
		$this->m_help = $this->load('help');

    }
    public function indexAction()
    {
	   
    }
}
